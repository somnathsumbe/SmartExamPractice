import type { ObjectId } from "mongodb";

export interface UserProfile {
  firstName: string;
  lastName: string;
  displayName: string;
  schoolName: string;
  className: string;
  division: string;
  board: string;
}

export interface UserPreferences {
  language: string;
  theme: string;
}

export interface UserDocument {
  _id: ObjectId;
  userName: string;
  email: string;
  mobile: string;
  passwordHash: string;
  profile: UserProfile;
  preferences: UserPreferences;
  role: "parent" | "student";
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export type PublicUser = Omit<UserDocument, "passwordHash" | "_id"> & {
  _id: string;
};