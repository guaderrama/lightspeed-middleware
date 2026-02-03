import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export interface CacheOptions {
  ttl?: number;  // Time to live en segundos (default: 21600 = 6 horas)
}

export class CacheService {
  private collection: FirebaseFirestore.CollectionReference;

  constructor(collectionName: string = 'cache') {
    this.collection = db.collection(collectionName);
  }

  /**
   * Guarda datos en el caché
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || 21600;  // 6 horas por defecto
    const expiresAt = new Date(Date.now() + ttl * 1000);

    try {
      await this.collection.doc(key).set({
        value: value,
        expiresAt: expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info('Cache set', {
        key,
        expiresAt: expiresAt.toISOString(),
        ttl: `${ttl}s`
      });
    } catch (error: any) {
      logger.error('Cache set error', {
        key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene datos del caché
   * Retorna null si no existe o ha expirado
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const doc = await this.collection.doc(key).get();

      if (!doc.exists) {
        logger.info('Cache miss - not found', { key });
        return null;
      }

      const data = doc.data();
      if (!data) {
        return null;
      }

      // Verificar expiración
      const expiresAt = data.expiresAt.toDate();
      const now = new Date();

      if (now > expiresAt) {
        logger.info('Cache miss - expired', {
          key,
          expiresAt: expiresAt.toISOString(),
          now: now.toISOString()
        });

        // Eliminar entrada expirada
        await this.delete(key);
        return null;
      }

      logger.info('Cache hit', {
        key,
        expiresAt: expiresAt.toISOString()
      });

      return data.value as T;
    } catch (error: any) {
      logger.error('Cache get error', {
        key,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Elimina una entrada del caché
   */
  async delete(key: string): Promise<void> {
    try {
      await this.collection.doc(key).delete();
      logger.info('Cache deleted', { key });
    } catch (error: any) {
      logger.error('Cache delete error', {
        key,
        error: error.message
      });
    }
  }

  /**
   * Limpia todas las entradas expiradas
   */
  async cleanup(): Promise<number> {
    try {
      const now = admin.firestore.Timestamp.now();
      const snapshot = await this.collection
        .where('expiresAt', '<', now)
        .get();

      if (snapshot.empty) {
        logger.info('Cache cleanup - no expired entries');
        return 0;
      }

      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      logger.info('Cache cleanup completed', {
        deletedCount: snapshot.size
      });

      return snapshot.size;
    } catch (error: any) {
      logger.error('Cache cleanup error', {
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Verifica si una entrada existe y está válida
   */
  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Actualiza el TTL de una entrada existente
   */
  async touch(key: string, ttl?: number): Promise<boolean> {
    try {
      const doc = await this.collection.doc(key).get();

      if (!doc.exists) {
        return false;
      }

      const newTtl = ttl || 21600;
      const expiresAt = new Date(Date.now() + newTtl * 1000);

      await this.collection.doc(key).update({
        expiresAt: expiresAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info('Cache touch', {
        key,
        newExpiresAt: expiresAt.toISOString()
      });

      return true;
    } catch (error: any) {
      logger.error('Cache touch error', {
        key,
        error: error.message
      });
      return false;
    }
  }
}
