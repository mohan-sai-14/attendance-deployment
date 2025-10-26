import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("student"),
  status: text("status").notNull().default("active"),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  created_by: text("created_by").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
  expires_at: timestamp("expires_at").notNull(),
  is_active: boolean("is_active").notNull().default(true),
  date: text("date"),
  time: text("time"),
  duration: integer("duration"),
  qr_code: text("qr_code"),
});

export const attendance = pgTable("attendance", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  session_id: text("session_id").notNull(),
  check_in_time: timestamp("check_in_time").notNull().defaultNow(),
  date: text("date"),
  status: text("status").notNull().default("present"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  user_id: true,
  password: true,
  name: true,
  email: true,
  role: true,
  status: true,
});

export const insertSessionSchema = z.object({
  name: z.string().min(1),
  created_by: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().optional(),
  duration: z.number().min(1).max(180).optional(),
  qr_code: z.string().optional(),
  expires_at: z.date(),
  is_active: z.boolean().default(true),
});

export const insertAttendanceSchema = z.object({
  user_id: z.string(),
  session_id: z.string(),
  check_in_time: z.string(),
  status: z.string().default("present"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendance.$inferSelect;

export const loginSchema = z.object({
  user_id: z.string().min(1, "User ID is required"),
  password: z.string().min(1, "Password is required"),
});