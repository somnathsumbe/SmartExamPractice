import type { Document, ObjectId } from "mongodb";

export type QuestionVariantType =
  | "mcq"
  | "true_false"
  | "fill_blank"
  | "one_sentence"
  | "short_answer"
  | "match_following"
  | "one_word"
  | "long_answer"
  | "rhyming_words"
  | "opposite_words"
  | "unscramble"
  | "sentence_making"
  | "vocabulary"
  | "grammar"
  | "sequencing"
  | "creative_writing"
  | "dialogue"
  | "picture_based"
  | "activity_based"
  | "match_pairs";

export type SupportedQuestionVariantType = Exclude<QuestionVariantType, "one_sentence" | "match_following">;

export type VariantDifficulty = "easy" | "medium" | "hard";
export type VariantStatus = "active" | "inactive";

export interface MatchingPair {
  left: string;
  right: string;
}

export interface QuestionVariantDocument extends Document {
  _id: ObjectId;
  userId: ObjectId;
  questionId: ObjectId;
  subjectId: ObjectId;
  chapterId: ObjectId;
  variantType: QuestionVariantType;
  questionText: string;
  options?: string[];
    answer: { text: string; acceptableAnswers: string[]; expectedItems?: string[] };
  pairs?: MatchingPair[];
    content?: QuestionVariantContent;
  explanation: string;
  difficulty: VariantDifficulty;
  marks: number;
  keywords: string[];
  status: VariantStatus;
  normalizedQuestionText: string;
  createdAt: Date;
  updatedAt: Date;
}

  export interface QuestionVariantContent {
    options?: string[];
    pairs?: MatchingPair[];
    items?: string[];
    correctOrder?: string[];
    scrambledText?: string;
    words?: string[];
    prompt?: string;
    word?: string;
    subtype?: string;
    topic?: string;
    instructions?: string;
    expectedKeyPoints?: string[];
    speakerNames?: string[];
    dialogueLines?: string[];
    pictureReference?: string;
    activityType?: string;
    activityInstructions?: string;
    teacherNotes?: string;
  }