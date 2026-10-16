// src/services/sessionService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './api';

const PROFILE_PREFIX = 'profile_';
const TOKEN_KEY = 'token';
const cache = {}; // In-memory cache for synchronous access

export default {
  /**
   * Saves a user profile to both in-memory cache and AsyncStorage.
   * @param {string} uid - The user's ID.
   * @param {object} profile - The user's profile object.
   */
  async saveProfile(uid, profile) {
    if (!uid || !profile) return;
    cache[uid] = profile;
    try {
      await AsyncStorage.setItem(PROFILE_PREFIX + uid, JSON.stringify(profile));
    } catch (e) {
      console.warn('saveProfile error', e);
    }
  },

  /**
   * Synchronously gets a profile from the in-memory cache.
   * @param {string} uid - The user's ID.
   * @returns {object|null} The cached profile or null.
   */
  getProfile(uid) {
    if (!uid) return null;
    return cache[uid] || null;
  },

  /**
   * Asynchronously loads a profile from AsyncStorage into the cache.
   * @param {string} uid - The user's ID.
   * @returns {Promise<object|null>} The loaded profile or null.
   */
  async loadProfileAsync(uid) {
    if (!uid) return null;
    try {
      const raw = await AsyncStorage.getItem(PROFILE_PREFIX + uid);
      if (!raw) return null;
      const profile = JSON.parse(raw);
      cache[uid] = profile; // Update cache
      return profile;
    } catch (e) {
      console.warn('loadProfileAsync error', e);
      return null;
    }
  },

  /**
   * Fetches a profile from the backend, saves it locally, and returns it.
   * It also normalizes emergencyContacts if they are stored as a JSON string.
   * @param {string} uid - The user's ID.
   * @returns {Promise<object|null>} The fetched profile or null.
   */
  async loadProfileFromBackend(uid) {
    if (!uid) return null;
    try {
      const response = await apiFetch(`/profiles/${uid}`, { method: 'GET' });
      if (response.ok && response.body) {
        const profile = response.body;

        // Normalize emergencyContacts from JSON string to array if necessary
        if (profile.emergencyContacts && typeof profile.emergencyContacts === 'string') {
          try {
            profile.emergencyContacts = JSON.parse(profile.emergencyContacts);
          } catch {
            profile.emergencyContacts = [];
          }
        }
        
        await this.saveProfile(uid, profile);
        return profile;
      }
    } catch (e) {
      console.warn('loadProfileFromBackend error', e);
    }
    return null;
  },

  /**
   * Attempts to find the current user's profile on app start.
   * It checks in-memory cache first, then AsyncStorage.
   * This is useful for automatically logging in a returning user.
   * @returns {Promise<object|null>} The current user's profile or null.
   */
  async getCurrentUser() {
    // 1. Check in-memory cache first (fastest)
    const cachedKeys = Object.keys(cache);
    if (cachedKeys.length > 0) {
      return cache[cachedKeys[0]];
    }

    // 2. If no cache, check AsyncStorage for any stored profile
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const profileKey = allKeys.find(key => key.startsWith(PROFILE_PREFIX));
      
      if (profileKey) {
        const rawProfile = await AsyncStorage.getItem(profileKey);
        if (rawProfile) {
          const profile = JSON.parse(rawProfile);
          cache[profile.id] = profile; // Repopulate cache
          return profile;
        }
      }
    } catch (e) {
      console.warn('getCurrentUser error', e);
    }

    // 3. Fallback if no profile is found locally
    return null;
  },

  /**
   * Clears a user's profile from both cache and AsyncStorage.
   * @param {string} uid - The user's ID.
   */
  async clearProfile(uid) {
    if (uid) {
      delete cache[uid];
      try {
        await AsyncStorage.removeItem(PROFILE_PREFIX + uid);
      } catch (e) {
        console.warn('clearProfile error', e);
      }
    }
  },

  // --- Token Helpers ---

  async saveToken(token) {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
      console.warn('saveToken error', e);
    }
  },

  async getToken() {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async clearToken() {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      console.warn('clearToken error', e);
    }
  },

  // --- ID Generators ---

  generateFamilyId() {
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `FAM-${randomPart}`;
  },

  generateIndividualId(name = '') {
    const namePart = (name || 'USER').split(' ')[0].substr(0, 3).toUpperCase();
    const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `IND-${namePart}-${randomPart}`;
  },
};