import { ObjectId } from "mongodb";
import { getUsersCollection } from "@/lib/mongodb";
import type { PublicUser, UserDocument, UserProfile } from "@/types/user";

export type RegistrationInput = {
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  passwordHash: string;
  schoolName: string;
  className: string;
  division: string;
  board: string;
};

export function toPublicUser(user: UserDocument): PublicUser {
  const publicUser = { ...user };
  Reflect.deleteProperty(publicUser, "passwordHash");
  return { ...publicUser, _id: user._id.toString() };
}

export async function createUser(input: RegistrationInput) {
  const users = await getUsersCollection();
  await Promise.all([
    users.createIndex({ userName: 1 }, { unique: true }),
    users.createIndex({ email: 1 }, { unique: true }),
  ]);

  const now = new Date();
  const profile: UserProfile = {
    firstName: input.firstName,
    lastName: input.lastName,
    displayName: [input.firstName, input.lastName].filter(Boolean).join(" "),
    schoolName: input.schoolName,
    className: input.className,
    division: input.division,
    board: input.board,
  };
  const user: UserDocument = {
    _id: new ObjectId(),
    userName: input.userName,
    email: input.email,
    mobile: input.mobile,
    passwordHash: input.passwordHash,
    profile,
    preferences: { language: "English", theme: "school" },
    role: "parent",
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };

  await users.insertOne(user);
  return user;
}

export async function findUserForLogin(identifier: string) {
  const users = await getUsersCollection();
  const value = identifier.trim().toLowerCase();
  return users.findOne({ $or: [{ userName: value }, { email: value }] });
}

export async function findActiveUserById(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const users = await getUsersCollection();
  return users.findOne({ _id: new ObjectId(id), status: "active" });
}

export async function updateProfile(userId: string, updates: Partial<UserProfile> & { mobile: string }) {
  const users = await getUsersCollection();
  const { mobile, ...profileUpdates } = updates;
  await users.updateOne(
    { _id: new ObjectId(userId), status: "active" },
    {
      $set: {
        mobile,
        ...Object.fromEntries(
          Object.entries(profileUpdates).map(([key, value]) => [`profile.${key}`, value]),
        ),
        updatedAt: new Date(),
      },
    },
  );
  return findActiveUserById(userId);
}

export async function recordLogin(userId: ObjectId) {
  const users = await getUsersCollection();
  const now = new Date();
  await users.updateOne({ _id: userId }, { $set: { lastLoginAt: now, updatedAt: now } });
}