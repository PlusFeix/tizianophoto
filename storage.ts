import { users, type User, type InsertUser, type Faq, type InsertFaq, type FaqCategory, type InsertFaqCategory, type AdminLog, type InsertAdminLog, type InsertReview, type Review, faqs, faqCategories, adminLogs, reviews, galleries, photos, availabilityDates, availabilityTimeSlots, type AvailabilityDate, type InsertAvailabilityDate, type AvailabilityTimeSlot, type InsertAvailabilityTimeSlot } from "@shared/schema";
import { db } from "./db";
import { eq, and, count, gte, lte } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Gallery methods
  getGalleryByAccessCode(code: string): Promise<{ id: number; accessCode: string; photos: { id: number; url: string }[] } | undefined>;
  getPhotosByGalleryId(galleryId: number): Promise<{ id: number; url: string; galleryId: number }[] | undefined>;

  // FAQ methods
  createFaqCategory(category: InsertFaqCategory): Promise<FaqCategory>;
  updateFaqCategory(id: number, category: Partial<FaqCategory>): Promise<FaqCategory>;
  deleteFaqCategory(id: number): Promise<void>;
  getFaqCategories(): Promise<FaqCategory[]>;

  createFaq(faq: InsertFaq): Promise<Faq>;
  updateFaq(id: number, faq: Partial<Faq>): Promise<Faq>;
  deleteFaq(id: number): Promise<void>;
  getFaqs(categoryId?: number): Promise<Faq[]>;

  // Admin methods
  getAdminStats(): Promise<{ faqCount: number; galleryCount: number; pendingReviewsCount: number }>;
  createAdminLog(log: InsertAdminLog): Promise<AdminLog>;
  getAdminLogs(adminId?: number): Promise<AdminLog[]>;

  // Review methods
  createReview(review: InsertReview): Promise<Review>;
  getApprovedReviews(): Promise<Review[]>;
  getPendingReviews(): Promise<Review[]>;
  updateReview(id: number, update: { status: string; modifiedContent?: string }): Promise<Review>;

  // Availability methods
  createAvailabilityDate(date: InsertAvailabilityDate): Promise<AvailabilityDate>;
  updateAvailabilityDate(id: number, isAvailable: boolean): Promise<AvailabilityDate>;
  getAvailabilityDates(startDate: Date, endDate: Date): Promise<AvailabilityDate[]>;

  createAvailabilityTimeSlot(slot: InsertAvailabilityTimeSlot): Promise<AvailabilityTimeSlot>;
  updateAvailabilityTimeSlot(id: number, isAvailable: boolean): Promise<AvailabilityTimeSlot>;
  getAvailabilityTimeSlots(dateId: number): Promise<AvailabilityTimeSlot[]>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Gallery methods
  async getGalleryByAccessCode(code: string): Promise<{ id: number; accessCode: string; photos: { id: number; url: string }[] } | undefined> {
    const [gallery] = await db
      .select({
        id: galleries.id,
        accessCode: galleries.accessCode,
      })
      .from(galleries)
      .where(eq(galleries.accessCode, code));

    if (!gallery) return undefined;

    const galleryPhotos = await db
      .select({
        id: photos.id,
        url: photos.url,
      })
      .from(photos)
      .where(eq(photos.galleryId, gallery.id));

    return {
      ...gallery,
      photos: galleryPhotos,
    };
  }

  async getPhotosByGalleryId(galleryId: number): Promise<{ id: number; url: string; galleryId: number }[] | undefined> {
    return db
      .select({
        id: photos.id,
        url: photos.url,
        galleryId: photos.galleryId,
      })
      .from(photos)
      .where(eq(photos.galleryId, galleryId));
  }

  // FAQ methods
  async createFaqCategory(category: InsertFaqCategory): Promise<FaqCategory> {
    const [newCategory] = await db.insert(faqCategories).values(category).returning();
    return newCategory;
  }

  async updateFaqCategory(id: number, category: Partial<FaqCategory>): Promise<FaqCategory> {
    const [updatedCategory] = await db
      .update(faqCategories)
      .set(category)
      .where(eq(faqCategories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteFaqCategory(id: number): Promise<void> {
    await db.delete(faqCategories).where(eq(faqCategories.id, id));
  }

  async getFaqCategories(): Promise<FaqCategory[]> {
    return db.select().from(faqCategories).orderBy(faqCategories.order);
  }

  async createFaq(faq: InsertFaq): Promise<Faq> {
    const [newFaq] = await db.insert(faqs).values(faq).returning();
    return newFaq;
  }

  async updateFaq(id: number, faq: Partial<Faq>): Promise<Faq> {
    const [updatedFaq] = await db
      .update(faqs)
      .set(faq)
      .where(eq(faqs.id, id))
      .returning();
    return updatedFaq;
  }

  async deleteFaq(id: number): Promise<void> {
    await db.delete(faqs).where(eq(faqs.id, id));
  }

  async getFaqs(categoryId?: number): Promise<Faq[]> {
    const query = db.select().from(faqs);
    if (categoryId) {
      query.where(eq(faqs.categoryId, categoryId));
    }
    return query.orderBy(faqs.order);
  }

  // Admin log methods
  async createAdminLog(log: InsertAdminLog): Promise<AdminLog> {
    const [newLog] = await db.insert(adminLogs).values(log).returning();
    return newLog;
  }

  async getAdminLogs(adminId?: number): Promise<AdminLog[]> {
    const query = db.select().from(adminLogs);
    if (adminId) {
      query.where(eq(adminLogs.adminId, adminId));
    }
    return query.orderBy(adminLogs.createdAt);
  }

  // Review methods
  async createReview(review: InsertReview): Promise<Review> {
    const [newReview] = await db.insert(reviews).values(review).returning();
    return newReview;
  }

  async getApprovedReviews(): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.status, 'approved'));
  }

  async getPendingReviews(): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.status, 'pending'));
  }

  async updateReview(id: number, update: { status: string; modifiedContent?: string }): Promise<Review> {
    const [updatedReview] = await db
      .update(reviews)
      .set({
        status: update.status,
        modifiedContent: update.modifiedContent,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, id))
      .returning();
    return updatedReview;
  }

  // Availability methods
  async createAvailabilityDate(date: InsertAvailabilityDate): Promise<AvailabilityDate> {
    const [newDate] = await db.insert(availabilityDates).values(date).returning();
    return newDate;
  }

  async updateAvailabilityDate(id: number, isAvailable: boolean): Promise<AvailabilityDate> {
    const [updatedDate] = await db
      .update(availabilityDates)
      .set({ isAvailable, updatedAt: new Date() })
      .where(eq(availabilityDates.id, id))
      .returning();
    return updatedDate;
  }

  async getAvailabilityDates(startDate: Date, endDate: Date): Promise<AvailabilityDate[]> {
    const dates = await db
      .select()
      .from(availabilityDates)
      .where(
        and(
          gte(availabilityDates.date, startDate),
          lte(availabilityDates.date, endDate)
        )
      )
      .orderBy(availabilityDates.date);

    // Per ogni data, ottieni anche i timeSlots associati
    const datesWithSlots = await Promise.all(
      dates.map(async (date) => {
        const timeSlots = await this.getAvailabilityTimeSlots(date.id);
        return {
          ...date,
          timeSlots,
        };
      })
    );

    return datesWithSlots;
  }

  async createAvailabilityTimeSlot(slot: InsertAvailabilityTimeSlot): Promise<AvailabilityTimeSlot> {
    const [newSlot] = await db.insert(availabilityTimeSlots).values(slot).returning();
    return newSlot;
  }

  async updateAvailabilityTimeSlot(id: number, isAvailable: boolean): Promise<AvailabilityTimeSlot> {
    const [updatedSlot] = await db
      .update(availabilityTimeSlots)
      .set({ isAvailable, updatedAt: new Date() })
      .where(eq(availabilityTimeSlots.id, id))
      .returning();
    return updatedSlot;
  }

  async getAvailabilityTimeSlots(dateId: number): Promise<AvailabilityTimeSlot[]> {
    return db
      .select()
      .from(availabilityTimeSlots)
      .where(eq(availabilityTimeSlots.dateId, dateId))
      .orderBy(availabilityTimeSlots.startTime);
  }
  async getAdminStats(): Promise<{ faqCount: number; galleryCount: number; pendingReviewsCount: number }> {
    const [faqCount] = await db.select({ count: count() }).from(faqs);
    const [galleryCount] = await db.select({ count: count() }).from(galleries);
    const [pendingReviewsCount] = await db.select({ count: count() }).from(reviews).where(eq(reviews.status, 'pending'));

    return {
      faqCount: faqCount?.count ?? 0,
      galleryCount: galleryCount?.count ?? 0,
      pendingReviewsCount: pendingReviewsCount?.count ?? 0
    };
  }
}

export const storage = new DatabaseStorage();