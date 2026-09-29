import { NextResponse } from "next/server";
import { integerField, invalidRequest, readJsonObject, statusField, stringField } from "@/lib/academic-api";
import { serverError } from "@/lib/api-response";
import { parseObjectId } from "@/services/academic-service";
import { isVariantDifficulty, isVariantStatus, isQuestionVariantType, QuestionVariantError, type QuestionVariantInput } from "@/services/question-variant-service";
import type { MatchingPair, QuestionVariantContent, VariantStatus } from "@/types/question-variant";

function stringList(value: unknown, maximumItems: number, maximumLength: number, lowercase = false) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maximumItems || value.some((item) => typeof item !== "string")) return null;
  const values = value.map((item) => (item as string).trim()).filter(Boolean);
  if (values.some((item) => item.length > maximumLength)) return null;
  const normalized = values.map((item) => lowercase ? item.toLocaleLowerCase("en") : item);
  return [...new Set(normalized)];
}

function parsePairs(value: unknown): MatchingPair[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 10) return null;
  const pairs: MatchingPair[] = [];
  for (const item of value) {
    const pair = readJsonObject(item);
    if (!pair) return null;
    const left = stringField(pair, "left", 300, true);
    const right = stringField(pair, "right", 300, true);
    if (left === null || right === null) return null;
    pairs.push({ left, right });
  }
  if (new Set(pairs.map((pair) => pair.left.toLocaleLowerCase("en"))).size !== pairs.length) return null;
  return pairs;
}

export function parseQuestionVariantInput(body: Record<string, unknown>): { input?: QuestionVariantInput; error?: string } {
  const questionValue = stringField(body, "questionId", 24, true);
  const subjectValue = stringField(body, "subjectId", 24, true);
  const chapterValue = stringField(body, "chapterId", 24, true);
  const questionId = questionValue ? parseObjectId(questionValue) : null;
  const subjectId = subjectValue ? parseObjectId(subjectValue) : null;
  const chapterId = chapterValue ? parseObjectId(chapterValue) : null;
  const variantType = body.variantType;
  const questionText = stringField(body, "questionText", 4000, true);
  const explanation = stringField(body, "explanation", 4000);
  const difficulty = body.difficulty;
  const status = statusField(body) as VariantStatus | null;
  const parsedMarks = integerField(body, "marks", 1);
  const marks = parsedMarks ?? 1;

  if (!questionId || !subjectId || !chapterId) return { error: "The question, subject, or chapter ID is invalid." };
  if (!isQuestionVariantType(variantType)) return { error: "Choose a valid variant type." };
  if (questionText === null) return { error: "Variant question is required and must be 4000 characters or fewer." };
  if (!isVariantDifficulty(difficulty)) return { error: "Choose a valid difficulty." };
  if (status === null || !isVariantStatus(status)) return { error: "Choose a valid status." };
  if (parsedMarks === null || marks > 100) return { error: "Marks must be a whole number between 1 and 100." };
  if (explanation === null) return { error: "Explanation must be 4000 characters or fewer." };

  const answerBody = readJsonObject(body.answer);
  if (!answerBody) return { error: "Enter the expected answer." };
  const answerValue = stringField(answerBody, "text", 4000);
  if (answerValue === null) return { error: "Answer must be 4000 characters or fewer." };
  const acceptableAnswers = stringList(answerBody.acceptableAnswers, 20, 1000);
  if (acceptableAnswers === null) return { error: "Use up to 20 acceptable answers, each under 1000 characters." };
  const expectedItems = stringList(answerBody.expectedItems, 40, 500);
  const keywords = stringList(body.keywords, 40, 80, true);
  if (expectedItems === null) return { error: "Use up to 40 expected items, each under 500 characters." };
  if (keywords === null) return { error: "Use up to 40 keywords, each under 80 characters." };

  let answerText = answerValue ?? "";
  let pairs: MatchingPair[] | undefined;
  let variantOptions: string[] | undefined;
  const rawContent = body.content === undefined ? {} : readJsonObject(body.content);
  if (!rawContent) return { error: "Variant content must be a valid object." };
  const content: QuestionVariantContent = {};
  const textFields = ["scrambledText", "prompt", "word", "subtype", "topic", "instructions", "pictureReference", "activityType", "activityInstructions", "teacherNotes"] as const;
  for (const key of textFields) {
    const value = stringField(rawContent, key, key === "pictureReference" ? 2000 : 4000);
    if (value === null) return { error: `The ${key} field is too long.` };
    if (value !== undefined) content[key] = value;
  }
  const listFields = ["items", "correctOrder", "words", "expectedKeyPoints", "speakerNames", "dialogueLines"] as const;
  for (const key of listFields) {
    const value = stringList(rawContent[key], 40, 1000);
    if (value === null) return { error: `Use up to 40 ${key}, each under 1000 characters.` };
    if (value.length) content[key] = value;
  }
  const options = stringList(rawContent.options ?? body.options, 4, 500);
  if (options === null && (rawContent.options !== undefined || body.options !== undefined)) return { error: "Use 2 to 4 options, each under 500 characters." };
  const pairSource = rawContent.pairs ?? body.pairs;
  const requiresPairs = variantType === "match_pairs" || variantType === "match_following";
  if (pairSource !== undefined) {
    pairs = parsePairs(pairSource) ?? undefined;
    if (!pairs) return { error: "Add 2 to 10 matching pairs with unique items in Column A." };
    content.pairs = pairs;
  }
  if (variantType === "mcq") {
    if (!options || options.length < 2) return { error: "MCQ variants need 2 to 4 different options." };
    if (new Set(options.map((option) => option.toLocaleLowerCase("en"))).size !== options.length) return { error: "MCQ options must be unique." };
    const correctOption = stringField(body, "correctOption", 500) ?? answerText;
    const matchedOption = options.find((option) => option.toLocaleLowerCase("en") === correctOption.toLocaleLowerCase("en"));
    if (!matchedOption) return { error: "The correct answer must match one of the options." };
    answerText = matchedOption;
    variantOptions = options;
    content.options = options;
  } else if (variantType === "true_false") {
    answerText = answerText.toLocaleLowerCase("en");
    if (answerText !== "true" && answerText !== "false") return { error: "True/False variants must have True or False as the answer." };
  } else if (requiresPairs && !pairs) {
    return { error: "Add at least 2 matching pairs." };
  }

  if (variantType === "one_word" && (!answerText.trim() || answerText.trim().split(/\s+/).length !== 1)) {
    return { error: "One Word answers must contain a single word." };
  }
  if (["fill_blank", "one_word", "short_answer", "long_answer", "opposite_words", "sentence_making", "one_sentence"].includes(variantType) && !answerText.trim()) return { error: "Enter the expected answer." };
  if (variantType === "unscramble" && (!content.scrambledText?.trim() || !answerText.trim())) return { error: "Unscramble variants need scrambled text and its correct answer." };
  if (variantType === "rhyming_words" && !answerText.trim() && !expectedItems?.length && !content.words?.length) return { error: "Add at least one expected rhyming word." };
  if (variantType === "sequencing") {
    if (!content.items || content.items.length < 2 || !content.correctOrder || content.correctOrder.length !== content.items.length) return { error: "Sequencing needs at least 2 items and a complete correct order." };
    if (content.correctOrder.some((item) => !content.items?.includes(item)) || new Set(content.correctOrder).size !== content.items.length) return { error: "The correct order must contain every item exactly once." };
  }
  if (variantType === "picture_based") {
    const reference = content.pictureReference?.trim() ?? "";
    let validReference = reference.startsWith("/") && !reference.startsWith("//");
    try { validReference ||= ["http:", "https:"].includes(new URL(reference).protocol); } catch { /* Relative paths are checked above. */ }
    if (!validReference) return { error: "Picture-based variants need an http(s) URL or an application-relative picture path." };
  }
  if (variantType === "vocabulary" && !["meaning", "synonym", "antonym", "word_usage"].includes(content.subtype ?? "")) return { error: "Choose a vocabulary subtype: meaning, synonym, antonym, or word usage." };
  if (variantType === "vocabulary" && !answerText.trim()) return { error: "Enter the expected vocabulary answer." };
  if (variantType === "grammar" && !["pronoun", "noun", "verb", "adjective", "article", "tense", "singular_plural", "gender", "other"].includes(content.subtype ?? "")) return { error: "Choose a valid grammar subtype." };
  if (variantType === "grammar" && !answerText.trim()) return { error: "Enter the expected grammar answer." };
  if (variantType === "creative_writing" && !["paragraph", "poem", "story", "description", "guided_writing"].includes(content.subtype ?? "")) return { error: "Choose a valid creative writing format." };
  if (variantType === "creative_writing" && !content.topic?.trim() && !content.prompt?.trim()) return { error: "Creative writing needs a topic or prompt." };
  if (variantType === "creative_writing" && !answerText.trim() && !content.expectedKeyPoints?.length && !keywords.length) return { error: "Add a model answer, expected key points, or keywords." };
  if (variantType === "dialogue" && !["complete", "create"].includes(content.subtype ?? "")) return { error: "Choose dialogue completion or create a dialogue." };
  if (variantType === "dialogue" && (!content.speakerNames || content.speakerNames.length < 2 || !content.dialogueLines || content.dialogueLines.length < 2)) return { error: "Add at least 2 speaker names and 2 dialogue lines." };
  if (variantType === "dialogue" && !answerText.trim() && !content.expectedKeyPoints?.length && !keywords.length) return { error: "Add a model dialogue, expected key points, or keywords." };
  if (variantType === "picture_based" && !answerText.trim() && !keywords.length) return { error: "Add an expected answer or keywords for the picture question." };
  if (variantType === "activity_based" && (!content.activityType || !["observation", "discussion", "role_play", "other"].includes(content.activityType) || !content.activityInstructions?.trim())) return { error: "Activity variants need a valid activity type and instructions." };
  if (variantType === "activity_based" && !answerText.trim() && !content.expectedKeyPoints?.length && !keywords.length) return { error: "Add an expected response, key points, or keywords." };
  if (variantType !== "mcq" && (rawContent.options !== undefined || body.options !== undefined)) return { error: "Options are only supported for MCQ variants." };
  if (!requiresPairs && (rawContent.pairs !== undefined || body.pairs !== undefined)) return { error: "Matching pairs are only supported for Match Pairs variants." };
  if (variantType === "long_answer" || variantType === "creative_writing") {
    if (marks < 3) return { error: "Long-answer and creative-writing variants must be worth at least 3 marks." };
  }

  return {
    input: {
      questionId,
      subjectId,
      chapterId,
      variantType,
      questionText,
      ...(variantOptions ? { options: variantOptions } : {}),
      answer: { text: answerText, acceptableAnswers, ...(expectedItems?.length ? { expectedItems } : {}) },
      ...(pairs ? { pairs } : {}),
      ...(Object.keys(content).length ? { content } : {}),
      explanation,
      difficulty,
      marks,
      keywords,
      status,
    },
  };
}

export function questionVariantFailure(error: unknown) {
  if (error instanceof QuestionVariantError) return NextResponse.json({ error: error.message }, { status: error.status });
  return serverError();
}

export { invalidRequest, readJsonObject };