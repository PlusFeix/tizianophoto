import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import type { InsertAvailabilityDate, InsertAvailabilityTimeSlot, InsertReview } from "@shared/schema";
import { setupAuth } from "./auth";
import contentRoutes from "./routes/content";

export function registerRoutes(app: Express): Server {
  const { requireAdmin } = setupAuth(app);

  // Aggiungiamo le rotte per i contenuti modificabili
  app.use(contentRoutes);

  // Rotte pubbliche
  app.get('/api/reviews', async (_req, res) => {
    try {
      const reviews = await storage.getApprovedReviews();
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: 'Errore nel recupero delle recensioni' });
    }
  });

  app.post('/api/reviews', async (req, res) => {
    try {
      const reviewData = req.body as InsertReview;
      const review = await storage.createReview(reviewData);
      res.status(201).json(review);
    } catch (error) {
      res.status(500).json({ error: 'Errore nella creazione della recensione' });
    }
  });

  // Rotte protette admin
  app.get('/api/admin/stats', requireAdmin, async (_req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Errore nel recupero delle statistiche' });
    }
  });

  app.get('/api/reviews/pending', requireAdmin, async (_req, res) => {
    try {
      const reviews = await storage.getPendingReviews();
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: 'Errore nel recupero delle recensioni in attesa' });
    }
  });

  app.patch('/api/reviews/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, modifiedContent } = req.body;

      const review = await storage.updateReview(parseInt(id), { status, modifiedContent });

      if (!review) {
        return res.status(404).json({ error: 'Recensione non trovata' });
      }

      res.json(review);
    } catch (error) {
      res.status(500).json({ error: 'Errore nell\'aggiornamento della recensione' });
    }
  });

  // Route per la gestione delle disponibilità
  app.get('/api/availability', async (_req, res) => {
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3);

      const dates = await storage.getAvailabilityDates(startDate, endDate);
      res.json(dates);
    } catch (error) {
      console.error('Error fetching availability:', error);
      res.status(500).json({ error: 'Errore nel recupero delle disponibilità' });
    }
  });

  app.post('/api/availability', requireAdmin, async (req, res) => {
    try {
      const dateData: InsertAvailabilityDate = {
        date: new Date(req.body.date),
        isAvailable: true,
      };
      const createdDate = await storage.createAvailabilityDate(dateData);
      res.status(201).json(createdDate);
    } catch (error) {
      console.error('Error creating availability:', error);
      res.status(500).json({ error: 'Errore nella creazione della disponibilità' });
    }
  });

  app.patch('/api/availability/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { isAvailable } = req.body;
      const date = await storage.updateAvailabilityDate(parseInt(id), isAvailable);
      res.json(date);
    } catch (error) {
      console.error('Error updating availability:', error);
      res.status(500).json({ error: 'Errore nell\'aggiornamento della disponibilità' });
    }
  });

  app.post('/api/availability/:id/timeslots', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const slotData: InsertAvailabilityTimeSlot = {
        dateId: parseInt(id),
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        isAvailable: req.body.isAvailable ?? true,
      };

      const slot = await storage.createAvailabilityTimeSlot(slotData);
      res.status(201).json(slot);
    } catch (error) {
      console.error('Error creating timeslot:', error);
      res.status(500).json({ error: 'Errore nella creazione dello slot orario' });
    }
  });

  app.patch('/api/availability/timeslots/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { isAvailable } = req.body;

      const slot = await storage.updateAvailabilityTimeSlot(parseInt(id), isAvailable);
      res.json(slot);
    } catch (error) {
      console.error('Error updating timeslot:', error);
      res.status(500).json({ error: 'Errore nell\'aggiornamento dello slot orario' });
    }
  });


  // Rotte gallerie
  app.get('/api/galleries/access/:code', async (req, res) => {
    try {
      const { code } = req.params;
      const gallery = await storage.getGalleryByAccessCode(code);

      if (!gallery) {
        return res.status(404).json({ error: 'Galleria non trovata' });
      }

      const photos = await storage.getPhotosByGalleryId(gallery.id);
      res.json({ ...gallery, photos });
    } catch (error) {
      res.status(500).json({ error: 'Errore del server' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}