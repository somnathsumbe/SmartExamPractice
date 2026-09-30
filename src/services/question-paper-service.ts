import { ObjectId, type Filter } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import type { ChapterDocument, SubjectDocument } from "@/types/academics";
import { questionTypeLabels, type QuestionDifficulty, type QuestionDocument, type QuestionType } from "@/types/question";
import type { PaperQuestion, PaperQuestionRule, PaperVariantName, PaperVariantSettings, QuestionPaperDocument, QuestionPaperGenerationMode, QuestionPaperSection, QuestionPaperStatus, QuestionPaperVariantDocument } from "@/types/question-paper";

const papersCollectionName = "questionPapers";
const variantsCollectionName = "questionPaperVariants";
const difficultyOrder: QuestionDifficulty[] = ["easy", "medium", "hard"];
const defaultVariantSettings: PaperVariantSettings = { shuffleQuestions: true, shuffleOptions: true, preventSameQuestionAtSamePosition: true };
let indexCreation: Promise<void> | undefined;

export class QuestionPaperError extends Error {
  constructor(message: string, readonly status: number, readonly details?: unknown) {
    super(message);
  }
}

export type PaperInput = {
  paperName: string;
  subjectId: ObjectId;
  className: string;
  chapterIds: ObjectId[];
  examType: string;
  duration: number;
  instructions: string;
  sections: Array<Omit<QuestionPaperSection, "questions" | "totalMarks"> & { questionIds?: ObjectId[] }>;
  generationMode: QuestionPaperGenerationMode;
  variantSettings: PaperVariantSettings;
  status: QuestionPaperStatus;
  difficultyDistribution?: Partial<Record<QuestionDifficulty, number>>;
  useAvailableQuestions?: boolean;
};

function randomIndex(maximum: number) {
  if (maximum < 1) return 0;
  const bytes = new Uint32Array(1);
  globalThis.crypto.getRandomValues(bytes);
  return bytes[0] % maximum;
}

function shuffled<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const otherIndex = randomIndex(index + 1);
    [result[index], result[otherIndex]] = [result[otherIndex], result[index]];
  }
  return result;
}

function serializeQuestion(question: PaperQuestion, hideAnswer = true) {
  return {
    questionId: question.questionId.toString(),
    chapterId: question.chapterId.toString(),
    questionType: question.questionType,
    marks: question.marks,
    order: question.order,
    snapshot: {
      question: question.snapshot.question,
      questionData: question.snapshot.questionData,
      marks: question.snapshot.marks,
      difficulty: question.snapshot.difficulty,
      ...(!hideAnswer ? { answer: question.snapshot.answer } : {}),
    },
  };
}

function serializeSection(section: QuestionPaperSection, hideAnswer = true) {
  return {
    sectionName: section.sectionName,
    instructions: section.instructions,
    questionTypes: section.questionTypes,
    questions: section.questions.map((question) => serializeQuestion(question, hideAnswer)),
    totalMarks: section.totalMarks,
  };
}

function serializePaper(paper: QuestionPaperDocument) {
  return {
    _id: paper._id.toString(),
    paperName: paper.paperName,
    subjectId: paper.subjectId.toString(),
    className: paper.className,
    chapterIds: paper.chapterIds.map((id) => id.toString()),
    examType: paper.examType,
    duration: paper.duration,
    totalMarks: paper.totalMarks,
    totalQuestions: paper.sections.reduce((sum, section) => sum + section.questions.length, 0),
    instructions: paper.instructions,
    sections: paper.sections.map((section) => serializeSection(section)),
    generationMode: paper.generationMode,
    variantSettings: variantSettingsFor(paper),
    status: paper.status,
    createdAt: paper.createdAt.toISOString(),
    updatedAt: paper.updatedAt.toISOString(),
  };
}

function serializeVariant(variant: QuestionPaperVariantDocument) {
  return {
    _id: variant._id.toString(),
    paperId: variant.paperId.toString(),
    variant: variant.variant,
    sections: variant.sections.map((section) => serializeSection(section)),
    totalQuestions: variant.totalQuestions,
    totalMarks: variant.totalMarks,
    duration: variant.duration,
    createdAt: variant.createdAt.toISOString(),
  };
}

function variantSettingsFor(paper: Pick<QuestionPaperDocument, "variantSettings">) {
  return paper.variantSettings ?? defaultVariantSettings;
}

export async function ensureQuestionPaperIndexes() {
  if (!indexCreation) {
    indexCreation = Promise.all([
      getCollection<QuestionPaperDocument>(papersCollectionName).then((papers) => Promise.all([
        papers.createIndex({ userId: 1, createdAt: -1 }, { name: "user_created" }),
        papers.createIndex({ userId: 1, subjectId: 1, className: 1, status: 1 }, { name: "user_subject_class_status" }),
        papers.createIndex({ userId: 1, chapterIds: 1 }, { name: "user_chapters" }),
      ])),
      getCollection<QuestionPaperVariantDocument>(variantsCollectionName).then((variants) => Promise.all([
        variants.createIndex({ userId: 1, paperId: 1, createdAt: -1 }, { name: "user_paper_created" }),
        variants.createIndex({ userId: 1, paperId: 1, variant: 1 }, { unique: true, name: "unique_paper_variant" }),
      ])),
    ]).then(() => undefined).catch((error: unknown) => {
      indexCreation = undefined;
      throw error;
    });
  }
  await indexCreation;
}

async function verifyScope(userId: ObjectId, subjectId: ObjectId, className: string, chapterIds: ObjectId[]) {
  const [subjects, chapters] = await Promise.all([
    getCollection<SubjectDocument>("subjects"),
    getCollection<ChapterDocument>("chapters"),
  ]);
  const subject = await subjects.findOne({ _id: subjectId, userId, status: "active" });
  if (!subject) throw new QuestionPaperError("Subject not found or inactive.", 404);
  if (subject.className !== className) throw new QuestionPaperError("Selected class must match the subject class.", 400);
  if (!chapterIds.length) throw new QuestionPaperError("Select at least one chapter.", 400);
  const uniqueChapterIds = new Map(chapterIds.map((id) => [id.toString(), id]));
  if (uniqueChapterIds.size !== chapterIds.length) throw new QuestionPaperError("A chapter cannot be selected more than once.", 400);
  const documents = await chapters.find({ _id: { $in: chapterIds }, userId, subjectId, status: "active" }).toArray();
  if (documents.length !== chapterIds.length) throw new QuestionPaperError("Every selected chapter must be active and belong to the chosen subject.", 400);
  return { subject, chapters: documents };
}

function allocationForCount(count: number, distribution?: Partial<Record<QuestionDifficulty, number>>) {
  if (!distribution) return undefined;
  const percentages = difficultyOrder.map((difficulty) => distribution[difficulty] ?? 0);
  if (percentages.some((value) => !Number.isInteger(value) || value < 0) || percentages.reduce((sum, value) => sum + value, 0) !== 100) {
    throw new QuestionPaperError("Difficulty percentages must be whole numbers that add up to 100.", 400);
  }
  const exact = percentages.map((percentage) => count * percentage / 100);
  const counts = exact.map(Math.floor);
  let remaining = count - counts.reduce((sum, value) => sum + value, 0);
  const remainderOrder = exact.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((left, right) => right.fraction - left.fraction);
  for (const item of remainderOrder) {
    if (!remaining) break;
    counts[item.index] += 1;
    remaining -= 1;
  }
  return Object.fromEntries(difficultyOrder.map((difficulty, index) => [difficulty, counts[index]])) as Record<QuestionDifficulty, number>;
}

async function readQuestionPool(userId: ObjectId, paper: Pick<QuestionPaperDocument, "subjectId" | "chapterIds">, rule: PaperQuestionRule) {
  const questions = await getCollection<QuestionDocument>("questions");
  return questions.find({
    userId,
    subjectId: paper.subjectId,
    chapterId: { $in: paper.chapterIds },
    questionType: rule.questionType,
    marks: rule.marks,
    status: "active",
  }).toArray();
}

function snapshot(question: QuestionDocument): PaperQuestion["snapshot"] {
  return {
    question: question.questionText,
    questionData: question.options ? { options: [...question.options] } : {},
    marks: question.marks,
    difficulty: question.difficulty,
    answer: { text: question.answer.text, acceptableAnswers: [...question.answer.acceptableAnswers] },
  };
}

function asPaperQuestion(question: QuestionDocument, order: number): PaperQuestion {
  return { questionId: question._id, chapterId: question.chapterId, questionType: question.questionType, marks: question.marks, order, snapshot: snapshot(question) };
}

function sample<T>(items: T[], count: number) {
  return shuffled(items).slice(0, count);
}

type GenerationControls = {
  allowAvailable: boolean;
  excludedIds?: Set<string>;
  avoidQuestionAtPosition?: Map<number, Set<string>>;
  shuffleQuestions?: boolean;
};

function sampleAtPositions(pool: QuestionDocument[], count: number, startPosition: number, controls: GenerationControls, alreadyChosen: QuestionDocument[] = []) {
  const selected: QuestionDocument[] = [];
  while (selected.length < count) {
    const alreadyUsed = new Set([...alreadyChosen, ...selected].map((question) => question._id.toString()));
    const available = pool.filter((question) => !alreadyUsed.has(question._id.toString()));
    if (!available.length) break;
    const position = startPosition + selected.length;
    const avoid = controls.avoidQuestionAtPosition?.get(position);
    const candidates = avoid ? available.filter((question) => !avoid.has(question._id.toString())) : available;
    if (!candidates.length && avoid) {
      throw new QuestionPaperError("Not enough distinct questions are available to avoid repeating one at the same position.", 409, { available: available.length, required: count });
    }
    const choices = candidates.length ? candidates : available;
    selected.push(...(controls.shuffleQuestions === false && controls.avoidQuestionAtPosition
      ? [...choices].sort((left, right) => left._id.toString().localeCompare(right._id.toString())).slice(0, 1)
      : sample(choices, 1)));
  }
  return selected;
}

function shuffleOptions(options: string[]) {
  const result = shuffled(options);
  if (result.length > 1 && result.every((option, index) => option === options[index])) {
    result.push(result.shift()!);
  }
  return result;
}

async function generateSections(userId: ObjectId, paper: Pick<QuestionPaperDocument, "subjectId" | "chapterIds" | "sections">, controls: GenerationControls) {
  const warnings: Array<{ message: string; available: number; required: number; difficulty?: QuestionDifficulty; questionType?: QuestionType }> = [];
  const sections: QuestionPaperSection[] = [];
  const usedQuestionIds = new Set<string>();
  let absolutePosition = 0;

  for (const section of paper.sections) {
    const questions: PaperQuestion[] = [];
    const normalizedRules: PaperQuestionRule[] = [];
    for (const rule of section.questionTypes) {
      const pool = (await readQuestionPool(userId, paper, rule)).filter((question) => !controls.excludedIds?.has(question._id.toString()) && !usedQuestionIds.has(question._id.toString()));
      const requestedDifficulties = rule.difficultyTargets;
      const chosen: QuestionDocument[] = [];
      if (requestedDifficulties) {
        for (const difficulty of difficultyOrder) {
          const required = requestedDifficulties[difficulty] ?? 0;
          if (!required) continue;
          const eligible = pool.filter((question) => question.difficulty === difficulty && !chosen.some((entry) => entry._id.equals(question._id)));
          const selected = sampleAtPositions(eligible, Math.min(required, eligible.length), absolutePosition + chosen.length, controls, chosen);
          chosen.push(...selected);
          if (selected.length < required) {
            warnings.push({ message: `Not enough ${difficulty} questions available for ${questionTypeLabels[rule.questionType]}.`, available: selected.length, required, difficulty, questionType: rule.questionType });
          }
        }
      } else {
        const required = rule.count;
        chosen.push(...sampleAtPositions(pool, Math.min(required, pool.length), absolutePosition, controls));
        if (chosen.length < required) warnings.push({ message: `Not enough questions available for ${questionTypeLabels[rule.questionType]}.`, available: chosen.length, required, questionType: rule.questionType });
      }

      if (requestedDifficulties && chosen.length < rule.count && controls.allowAvailable) {
        const remaining = pool.filter((question) => !chosen.some((entry) => entry._id.equals(question._id)));
        const needed = Math.min(rule.count - chosen.length, remaining.length);
        chosen.push(...sampleAtPositions(remaining, needed, absolutePosition + chosen.length, controls, chosen));
      }

      if (chosen.length < rule.count && !controls.allowAvailable) {
        throw new QuestionPaperError(warnings.at(-1)?.message ?? `Not enough questions available for ${questionTypeLabels[rule.questionType]}.`, 409, warnings.at(-1));
      }
      if (requestedDifficulties && controls.allowAvailable) {
        const counts: Partial<Record<QuestionDifficulty, number>> = {};
        for (const question of chosen) counts[question.difficulty] = (counts[question.difficulty] ?? 0) + 1;
        normalizedRules.push({ ...rule, count: chosen.length, difficultyCounts: counts, difficultyTargets: counts });
      } else {
        const counts: Partial<Record<QuestionDifficulty, number>> = {};
        for (const question of chosen) counts[question.difficulty] = (counts[question.difficulty] ?? 0) + 1;
        normalizedRules.push({ ...rule, count: chosen.length, difficultyCounts: counts });
      }
      const orderedQuestions = controls.shuffleQuestions === false && !controls.avoidQuestionAtPosition
        ? [...chosen].sort((left, right) => left._id.toString().localeCompare(right._id.toString()))
        : chosen;
      for (const question of orderedQuestions) {
        usedQuestionIds.add(question._id.toString());
        const position = absolutePosition++;
        questions.push(asPaperQuestion(question, questions.length + 1));
        if (controls.avoidQuestionAtPosition) {
          const avoid = controls.avoidQuestionAtPosition.get(position) ?? new Set<string>();
          avoid.add(question._id.toString());
          controls.avoidQuestionAtPosition.set(position, avoid);
        }
      }
    }
    const totalMarks = questions.reduce((sum, question) => sum + question.marks, 0);
    sections.push({ sectionName: section.sectionName, instructions: section.instructions, questionTypes: normalizedRules, questions, totalMarks });
  }
  return { sections, warnings, totalQuestions: sections.reduce((sum, section) => sum + section.questions.length, 0), totalMarks: sections.reduce((sum, section) => sum + section.totalMarks, 0) };
}

function flattenQuestionIds(sections: QuestionPaperSection[]) {
  return sections.flatMap((section) => section.questions.map((question) => question.questionId.toString()));
}

async function hydrateManualSections(userId: ObjectId, input: PaperInput, existingPaper?: QuestionPaperDocument) {
  const allIds = input.sections.flatMap((section) => section.questionIds ?? []);
  if (!allIds.length) throw new QuestionPaperError("Select at least one question from the Question Bank.", 400);
  const uniqueIds = new Map(allIds.map((id) => [id.toString(), id]));
  if (uniqueIds.size !== allIds.length) throw new QuestionPaperError("A question cannot appear more than once in the same paper.", 400);
  const questions = await getCollection<QuestionDocument>("questions");
  const documents = await questions.find({ _id: { $in: allIds }, userId, subjectId: input.subjectId, chapterId: { $in: input.chapterIds } }).toArray();
  if (documents.length !== allIds.length) throw new QuestionPaperError("Every selected question must belong to the selected subject and chapters.", 400);
  const questionMap = new Map(documents.map((question) => [question._id.toString(), question]));
  const existingQuestionMap = new Map((existingPaper?.sections ?? []).flatMap((section) => section.questions.map((question) => [question.questionId.toString(), question] as const)));
  const sections: QuestionPaperSection[] = input.sections.map((section) => {
    const rules = section.questionTypes.filter((rule) => rule.count > 0);
    const selected = (section.questionIds ?? []).map((id) => {
      const question = questionMap.get(id.toString());
      const savedQuestion = existingQuestionMap.get(id.toString());
      if (!question || (!savedQuestion && question.status !== "active")) return null;
      return {
        question,
        paperQuestion: savedQuestion,
        questionType: savedQuestion?.questionType ?? question.questionType,
        marks: savedQuestion?.marks ?? question.marks,
        difficulty: savedQuestion?.snapshot.difficulty ?? question.difficulty,
      };
    }).filter((selection): selection is NonNullable<typeof selection> => selection !== null);
    if (selected.length !== rules.reduce((sum, rule) => sum + rule.count, 0)) throw new QuestionPaperError(`Selected question count does not match section "${section.sectionName}".`, 400);
    const remaining = [...selected];
    const normalizedRules = rules.map((rule) => {
      const matching = remaining.filter((selection) => selection.questionType === rule.questionType && selection.marks === rule.marks);
      if (matching.length !== rule.count) throw new QuestionPaperError(`Section "${section.sectionName}" does not have the configured number of ${questionTypeLabels[rule.questionType]} questions worth ${rule.marks} marks.`, 400);
      for (const selection of matching) remaining.splice(remaining.findIndex((item) => item.question._id.equals(selection.question._id)), 1);
      const difficultyTargets = rule.difficultyTargets;
      if (difficultyTargets && difficultyOrder.some((difficulty) => matching.filter((selection) => selection.difficulty === difficulty).length !== (difficultyTargets[difficulty] ?? 0))) {
        throw new QuestionPaperError(`Selected difficulty distribution does not match section "${section.sectionName}".`, 400);
      }
      const actualDifficultyCounts = Object.fromEntries(difficultyOrder.map((difficulty) => [
        difficulty, matching.filter((selection) => selection.difficulty === difficulty).length,
      ])) as Record<QuestionDifficulty, number>;
      return { ...rule, difficultyCounts: actualDifficultyCounts };
    });
    const paperQuestions = selected.map((selection, index) => selection.paperQuestion
      ? { ...selection.paperQuestion, order: index + 1 }
      : asPaperQuestion(selection.question, index + 1));
    return { sectionName: section.sectionName, instructions: section.instructions, questionTypes: normalizedRules, questions: paperQuestions, totalMarks: paperQuestions.reduce((sum, question) => sum + question.marks, 0) };
  });
  return sections;
}

function validateRules(sections: PaperInput["sections"]) {
  if (!sections.length) throw new QuestionPaperError("Add at least one section.", 400);
  for (const section of sections) {
    if (!section.sectionName.trim()) throw new QuestionPaperError("Every section needs a name.", 400);
    const rules = section.questionTypes.filter((rule) => rule.count > 0);
    if (!rules.length) throw new QuestionPaperError(`Add at least one question type to section "${section.sectionName}".`, 400);
    if (rules.some((rule) => !Object.hasOwn(questionTypeLabels, rule.questionType) || !Number.isInteger(rule.count) || rule.count < 1 || !Number.isInteger(rule.marks) || rule.marks < 1 || rule.marks > 5)) {
      throw new QuestionPaperError("Question type counts and marks are invalid.", 400);
    }
    const keySet = new Set<string>();
    for (const rule of rules) {
      const key = `${rule.questionType}:${rule.marks}`;
      if (keySet.has(key)) throw new QuestionPaperError("Each question type and mark value can only appear once per section.", 400);
      keySet.add(key);
      if (rule.difficultyTargets && Object.values(rule.difficultyTargets).reduce((sum, count) => sum + (count ?? 0), 0) !== rule.count) {
        throw new QuestionPaperError("Difficulty counts must add up to the question count.", 400);
      }
    }
  }
}

export async function createQuestionPaper(userId: ObjectId, input: PaperInput) {
  await ensureQuestionPaperIndexes();
  validateRules(input.sections);
  await verifyScope(userId, input.subjectId, input.className, input.chapterIds);
  let sections: QuestionPaperSection[];
  let warnings: unknown[] = [];
  if (input.generationMode === "MANUAL") {
    sections = await hydrateManualSections(userId, input);
  } else {
    const rules = input.sections.map((section) => ({ ...section, questionTypes: section.questionTypes.filter((rule) => rule.count > 0).map((rule) => ({ ...rule, difficultyTargets: allocationForCount(rule.count, input.difficultyDistribution) })) }));
    const generated = await generateSections(userId, { subjectId: input.subjectId, chapterIds: input.chapterIds, sections: rules.map((section) => ({ ...section, questions: [], totalMarks: 0 })) }, { allowAvailable: input.useAvailableQuestions === true, shuffleQuestions: input.variantSettings.shuffleQuestions });
    sections = generated.sections;
    warnings = generated.warnings;
  }
  const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0);
  const totalMarks = sections.reduce((sum, section) => sum + section.totalMarks, 0);
  if (totalQuestions < 1) throw new QuestionPaperError("A paper must contain at least one question.", 400);
  const now = new Date();
  const paper: QuestionPaperDocument = {
    _id: new ObjectId(), userId, paperName: input.paperName, subjectId: input.subjectId, className: input.className,
    chapterIds: input.chapterIds, examType: input.examType, duration: input.duration, totalMarks,
    instructions: input.instructions, sections, generationMode: input.generationMode, variantSettings: input.variantSettings, status: input.status,
    createdBy: userId, updatedBy: userId, createdAt: now, updatedAt: now,
  };
  const collection = await getCollection<QuestionPaperDocument>(papersCollectionName);
  await collection.insertOne(paper);
  return { paper: serializePaper(paper), warnings };
}

export async function listQuestionPapers(userId: ObjectId, filters: { subjectId?: ObjectId; className?: string; chapterId?: ObjectId; status?: QuestionPaperStatus; search?: string; page: number; pageSize: number }) {
  await ensureQuestionPaperIndexes();
  const collection = await getCollection<QuestionPaperDocument>(papersCollectionName);
  const query: Filter<QuestionPaperDocument> = { userId };
  if (filters.subjectId) query.subjectId = filters.subjectId;
  if (filters.className) query.className = filters.className;
  if (filters.chapterId) query.chapterIds = filters.chapterId;
  if (filters.status) query.status = filters.status;
  if (filters.search) query.paperName = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const [documents, total] = await Promise.all([
    collection.find(query).sort({ createdAt: -1, _id: -1 }).skip((filters.page - 1) * filters.pageSize).limit(filters.pageSize).toArray(),
    collection.countDocuments(query),
  ]);
  const subjects = await getCollection<SubjectDocument>("subjects");
  const subjectIds = [...new Map(documents.map((paper) => [paper.subjectId.toString(), paper.subjectId])).values()];
  const subjectDocuments = subjectIds.length ? await subjects.find({ _id: { $in: subjectIds }, userId }, { projection: { name: 1 } }).toArray() : [];
  const subjectMap = new Map(subjectDocuments.map((subject) => [subject._id.toString(), subject.name]));
  const chapterIds = [...new Map(documents.flatMap((paper) => paper.chapterIds).map((id) => [id.toString(), id])).values()];
  const chapterCollection = await getCollection<ChapterDocument>("chapters");
  const chapterDocuments = chapterIds.length ? await chapterCollection.find({ _id: { $in: chapterIds }, userId }, { projection: { name: 1, chapterNumber: 1 } }).toArray() : [];
  const chapterMap = new Map(chapterDocuments.map((chapter) => [chapter._id.toString(), `${chapter.chapterNumber}. ${chapter.name}`]));
  return {
    papers: documents.map((paper) => ({
      ...serializePaper(paper), subject: { _id: paper.subjectId.toString(), name: subjectMap.get(paper.subjectId.toString()) ?? "Unknown subject" },
      chapters: paper.chapterIds.map((id) => ({ _id: id.toString(), name: chapterMap.get(id.toString()) ?? "Unknown chapter" })),
    })),
    pagination: { page: filters.page, pageSize: filters.pageSize, total, totalPages: Math.ceil(total / filters.pageSize) },
  };
}

export async function getQuestionPaper(userId: ObjectId, paperId: ObjectId) {
  await ensureQuestionPaperIndexes();
  const collection = await getCollection<QuestionPaperDocument>(papersCollectionName);
  const paper = await collection.findOne({ _id: paperId, userId });
  if (!paper) return null;
  const subjects = await getCollection<SubjectDocument>("subjects");
  const subject = await subjects.findOne({ _id: paper.subjectId, userId });
  return { ...serializePaper(paper), subject: subject ? { _id: subject._id.toString(), name: subject.name } : { _id: paper.subjectId.toString(), name: "Unknown subject" } };
}

export async function updateQuestionPaper(userId: ObjectId, paperId: ObjectId, input: PaperInput) {
  await ensureQuestionPaperIndexes();
  const collection = await getCollection<QuestionPaperDocument>(papersCollectionName);
  const current = await collection.findOne({ _id: paperId, userId });
  if (!current) return null;
  validateRules(input.sections);
  await verifyScope(userId, input.subjectId, input.className, input.chapterIds);
  const sameChapterSet = current.chapterIds.length === input.chapterIds.length && current.chapterIds.every((id) => input.chapterIds.some((candidate) => candidate.equals(id)));
  const currentVariantSettings = variantSettingsFor(current);
  const sameRandomConfiguration = input.generationMode === "RANDOM" && current.generationMode === "RANDOM"
    && current.subjectId.equals(input.subjectId) && current.className === input.className && sameChapterSet
    && JSON.stringify(currentVariantSettings) === JSON.stringify(input.variantSettings)
    && current.sections.length === input.sections.length
    && current.sections.every((section, index) => {
      const requested = input.sections[index];
      return section.questionTypes.length === requested.questionTypes.length
        && section.questionTypes.every((rule, ruleIndex) => {
          const nextRule = requested.questionTypes[ruleIndex];
          return rule.questionType === nextRule.questionType && rule.count === nextRule.count && rule.marks === nextRule.marks
            && JSON.stringify(rule.difficultyTargets ?? null) === JSON.stringify(nextRule.difficultyTargets ?? null);
        });
    });
  const sections = input.generationMode === "MANUAL"
    ? await hydrateManualSections(userId, input, current)
    : sameRandomConfiguration
      ? current.sections.map((section, index) => ({ ...section, sectionName: input.sections[index].sectionName, instructions: input.sections[index].instructions }))
      : (await generateSections(userId, {
        subjectId: input.subjectId, chapterIds: input.chapterIds,
        sections: input.sections.map((section) => ({ ...section, questions: [], totalMarks: 0 })),
      }, { allowAvailable: input.useAvailableQuestions === true, shuffleQuestions: input.variantSettings.shuffleQuestions })).sections;
  const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0);
  if (!totalQuestions) throw new QuestionPaperError("A paper must contain at least one question.", 400);
  await collection.updateOne({ _id: paperId, userId }, { $set: {
    paperName: input.paperName, subjectId: input.subjectId, className: input.className, chapterIds: input.chapterIds,
    examType: input.examType, duration: input.duration, totalMarks: sections.reduce((sum, section) => sum + section.totalMarks, 0),
    instructions: input.instructions, sections, generationMode: input.generationMode, variantSettings: input.variantSettings, status: input.status,
    updatedBy: userId, updatedAt: new Date(),
  } });
  return getQuestionPaper(userId, paperId);
}

export async function archiveQuestionPaper(userId: ObjectId, paperId: ObjectId) {
  await ensureQuestionPaperIndexes();
  const collection = await getCollection<QuestionPaperDocument>(papersCollectionName);
  const result = await collection.findOneAndUpdate({ _id: paperId, userId }, { $set: { status: "ARCHIVED", updatedBy: userId, updatedAt: new Date() } }, { returnDocument: "after" });
  return result ? serializePaper(result) : null;
}

export async function generateQuestionPaper(userId: ObjectId, paperId: ObjectId, allowAvailable: boolean) {
  await ensureQuestionPaperIndexes();
  const collection = await getCollection<QuestionPaperDocument>(papersCollectionName);
  const paper = await collection.findOne({ _id: paperId, userId });
  if (!paper) return null;
  if (paper.generationMode !== "RANDOM") throw new QuestionPaperError("Only random-selection papers can be regenerated.", 400);
  const generated = await generateSections(userId, paper, { allowAvailable, shuffleQuestions: variantSettingsFor(paper).shuffleQuestions });
  const duplicateIds = flattenQuestionIds(generated.sections);
  if (new Set(duplicateIds).size !== duplicateIds.length) throw new QuestionPaperError("Generator returned a duplicate question. Try again.", 500);
  await collection.updateOne({ _id: paperId, userId }, { $set: { sections: generated.sections, totalMarks: generated.totalMarks, updatedBy: userId, updatedAt: new Date() } });
  return { paper: await getQuestionPaper(userId, paperId), warnings: generated.warnings };
}

export async function generateQuestionPaperVariants(userId: ObjectId, paperId: ObjectId) {
  await ensureQuestionPaperIndexes();
  const papers = await getCollection<QuestionPaperDocument>(papersCollectionName);
  const paper = await papers.findOne({ _id: paperId, userId });
  if (!paper) return null;
  const variants = await getCollection<QuestionPaperVariantDocument>(variantsCollectionName);
  const existing = await variants.find({ userId, paperId }).toArray();
  const variantNames: PaperVariantName[] = ["A", "B", "C"];
  const generated: QuestionPaperVariantDocument[] = [];
  const avoidPositions = new Map<number, Set<string>>();
  const seenFingerprints = new Set<string>();
  let basePosition = 0;
  for (const section of paper.sections) {
    for (const question of section.questions) {
      const avoid = avoidPositions.get(basePosition) ?? new Set<string>();
      avoid.add(question.questionId.toString());
      avoidPositions.set(basePosition, avoid);
      basePosition += 1;
    }
  }
  seenFingerprints.add(flattenQuestionIds(paper.sections).join(","));
  for (const variant of existing) {
    let position = 0;
    for (const section of variant.sections) for (const question of section.questions) {
      const avoid = avoidPositions.get(position) ?? new Set<string>();
      avoid.add(question.questionId.toString());
      avoidPositions.set(position, avoid);
      position += 1;
    }
    seenFingerprints.add(flattenQuestionIds(variant.sections).join(","));
  }
  const missing = variantNames.filter((name) => !existing.some((variant) => variant.variant === name));
  const variantRequirements: Pick<QuestionPaperDocument, "subjectId" | "chapterIds" | "sections"> = {
    subjectId: paper.subjectId,
    chapterIds: paper.chapterIds,
    sections: paper.sections.map((section) => ({
      ...section,
      questionTypes: section.questionTypes.map((rule) => ({ ...rule, difficultyTargets: rule.difficultyCounts })),
    })),
  };
  for (const name of missing) {
    const result = await generateSections(userId, variantRequirements, {
      allowAvailable: false,
      shuffleQuestions: variantSettingsFor(paper).shuffleQuestions,
      ...(variantSettingsFor(paper).preventSameQuestionAtSamePosition ? { avoidQuestionAtPosition: avoidPositions } : {}),
    });
    const ids = flattenQuestionIds(result.sections);
    const fingerprint = ids.join(",");
    if (seenFingerprints.has(fingerprint)) throw new QuestionPaperError(`Not enough distinct questions are available to generate Paper ${name} without duplicating an existing paper.`, 409);
    if (new Set(ids).size !== ids.length) throw new QuestionPaperError(`Paper ${name} contains repeated questions.`, 500);
    for (const section of result.sections) for (const question of section.questions) {
      if (variantSettingsFor(paper).shuffleOptions && question.questionType === "mcq" && question.snapshot.questionData.options) {
        question.snapshot.questionData.options = shuffleOptions(question.snapshot.questionData.options);
      }
    }
    const now = new Date();
    const variant: QuestionPaperVariantDocument = {
      _id: new ObjectId(), userId, paperId, variant: name, sections: result.sections,
      totalQuestions: result.totalQuestions, totalMarks: result.totalMarks, duration: paper.duration, createdAt: now, updatedAt: now,
    };
    generated.push(variant);
    let position = 0;
    for (const section of result.sections) for (const question of section.questions) {
      const avoid = avoidPositions.get(position) ?? new Set<string>();
      avoid.add(question.questionId.toString());
      avoidPositions.set(position, avoid);
      position += 1;
    }
    seenFingerprints.add(fingerprint);
  }
  if (generated.length) await variants.insertMany(generated);
  return generated.map(serializeVariant);
}

export async function listQuestionPaperVariants(userId: ObjectId, paperId: ObjectId) {
  await ensureQuestionPaperIndexes();
  const papers = await getCollection<QuestionPaperDocument>(papersCollectionName);
  if (!(await papers.findOne({ _id: paperId, userId }, { projection: { _id: 1 } }))) return null;
  const variants = await getCollection<QuestionPaperVariantDocument>(variantsCollectionName);
  return (await variants.find({ userId, paperId }).sort({ variant: 1 }).toArray()).map(serializeVariant);
}

export async function getQuestionPaperVariant(userId: ObjectId, paperId: ObjectId, variantName: string) {
  await ensureQuestionPaperIndexes();
  const variants = await getCollection<QuestionPaperVariantDocument>(variantsCollectionName);
  const variant = await variants.findOne({ userId, paperId, variant: variantName });
  return variant ? serializeVariant(variant) : null;
}

export async function getQuestionPaperAnswerKey(userId: ObjectId, paperId: ObjectId, variantName?: string) {
  await ensureQuestionPaperIndexes();
  const paper = await getCollection<QuestionPaperDocument>(papersCollectionName).then((collection) => collection.findOne({ _id: paperId, userId }));
  if (!paper) return null;
  let sections = paper.sections;
  let name = "Main";
  if (variantName) {
    const variant = await getCollection<QuestionPaperVariantDocument>(variantsCollectionName).then((collection) => collection.findOne({ userId, paperId, variant: variantName }));
    if (!variant) return null;
    sections = variant.sections;
    name = variant.variant;
  }
  return {
    paperName: paper.paperName,
    variant: name,
    sections: sections.map((section) => ({
      sectionName: section.sectionName,
      questions: section.questions.map((question) => ({
        order: question.order,
        question: question.snapshot.question,
        answer: question.snapshot.answer.text,
        acceptableAnswers: question.snapshot.answer.acceptableAnswers,
      })),
    })),
  };
}

export async function duplicateQuestionPaper(userId: ObjectId, paperId: ObjectId) {
  await ensureQuestionPaperIndexes();
  const papers = await getCollection<QuestionPaperDocument>(papersCollectionName);
  const existing = await papers.findOne({ _id: paperId, userId });
  if (!existing) return null;
  const now = new Date();
  const copy: QuestionPaperDocument = {
    ...existing, _id: new ObjectId(), paperName: `${existing.paperName} (Copy)`, status: "DRAFT",
    variantSettings: variantSettingsFor(existing),
    createdBy: userId, updatedBy: userId, createdAt: now, updatedAt: now,
  };
  await papers.insertOne(copy);
  return serializePaper(copy);
}