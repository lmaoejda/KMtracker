import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export type LatLng = [number, number];

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("users_email_idx").on(t.email)],
);

export const routes = pgTable(
  "routes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("manual"), // 'manual' | 'tracking'
    points: jsonb("points")
      .$type<LatLng[]>()
      .notNull()
      .default([]),
    distanceM: real("distance_m").notNull().default(0),
    durationS: integer("duration_s").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("routes_user_idx").on(t.userId, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type RouteRow = typeof routes.$inferSelect;
