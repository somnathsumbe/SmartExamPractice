import type { Document, ObjectId } from "mongodb";

export const questionTypeLabels = {
  mcq: "MCQ",
  true_false: "True / False",
  fill_blank: "Fill in the Blanks",
  one_sentence: "One Sentence Answer",
  short_answer: "Short Answer",
  match_following: "Match the Pairs",
  match_pairs: "Match Word to Meaning",
  one_word: "One Word",
  long_answer: "Long Answer",
  rhyming_words: "Rhyming Words",
  opposite_words: "Opposite Words",
  unscramble: "Unscramble",
  sentence_making: "Sentence Making",
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  sequencing: "Sequencing",
  creative_writing: "Creative Writing",
  dialogue: "Dialogue",
  picture_based: "Picture Based",
  activity_based: "Activity Based",
} as const;

export type QuestionType = keyof typeof questionTypeLabels;
export type QuestionDifficulty = "easy" | "medium" | "hard";
export type QuestionStatus = "active" | "inactive";

export interface QuestionAnswer {
  text: string;
  acceptableAnswers: string[];
}

export interface QuestionDocument extends Document {
  _id: ObjectId;
  userId: ObjectId;
  subjectId: ObjectId;
  chapterId: ObjectId;
  questionText: string;
  normalizedQuestionText: string;
  questionType: QuestionType;
  difficulty: QuestionDifficulty;
  answer: QuestionAnswer;
  explanation: string;
  marks: number;
  keywords: string[];
  status: QuestionStatus;
  options?: string[];
  correctOption?: string;
  createdAt: Date;
  updatedAt: Date;
}