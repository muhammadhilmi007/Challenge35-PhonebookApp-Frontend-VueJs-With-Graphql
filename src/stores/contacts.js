import { defineStore } from "pinia";
import axios from "axios";
import { debounce } from "lodash-es";
import { useSessionStorage } from '@vueuse/core';

export const useContactStore = defineStore("contacts", {
  state: () => ({
    contacts: [],
    search: useSessionStorage("contactSearch", ""),
    sortOrder: useSessionStorage("contactSortOrder", "asc"),
    sortBy: useSessionStorage("contactSortBy", "name"),
    currentPage: 1,
    loading: false,
    hasMore: true,
    error: null,
    isOffline: !navigator.onLine,
    pageSize: 10,
    loadingMore: false,
    totalPages: 0,
    pendingContacts: useSessionStorage("pendingContacts", []),
    contactsCache: new Map(),
    cacheDuration: 5 * 60 * 1000, // 5 minutes
  }),

  getters: {
    sortedAndFilteredContacts: (state) => {
      return state.sortAndFilterContacts([...state.pendingContacts, ...state.contacts]);
    },
  },

  actions: {
    // ===== Cache Management =====
    getCacheKey(page, limit, sortBy, sortOrder, search) {
      return `${page}-${limit}-${sortBy}-${sortOrder}-${search}`;
    },

    setCacheData(key, data) {
      this.contactsCache.set(key, {
        data,
        timestamp: Date.now(),
      });
    },

    getCacheData(key) {
      const cached = this.contactsCache.get(key);
      if (!cached) return null;

      const isExpired = Date.now() - cached.timestamp > this.cacheDuration;
      if (isExpired) {
        this.contactsCache.delete(key);
        return null;
      }

      return cached.data;
    },

    clearCache() {
      this.contactsCache.clear();
    },

    // ===== Session Storage Management =====
    saveToSessionStorage(key, data) {
      sessionStorage.setItem(key, JSON.stringify(data));
    },

    getFromSessionStorage(key, defaultValue = []) {
      try {
        const data = sessionStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
      } catch (error) {
        console.error(`Error parsing data from sessionStorage (${key}):`, error);
        return defaultValue;
      }
    },

    savePendingContacts() {
      this.saveToSessionStorage("pendingContacts", this.pendingContacts);
    },

    // ===== Network Status Management =====
    checkConnection() {
      this.isOffline = !navigator.onLine;
      return !this.isOffline;
    },

    setOnlineStatus(status) {
      this.isOffline = !status;
      if (status) {
        this.syncPendingContacts();
      }
    },

    // ===== Contact Fetching =====
    async fetchContacts(loadMore = false) {
      if (this.loading) return;
      this.loading = true;
      this.error = null;

      try {
        // Get pending contacts from session storage
        const pendingContacts = this.getFromSessionStorage("pendingContacts", []);
        this.pendingContacts = pendingContacts;

        if (!navigator.onLine) {
          // In offline mode, use cached data
          const existingContacts = this.getFromSessionStorage("existingContacts", []);
          this.contacts = this.sortAndFilterContacts([...pendingContacts, ...existingContacts]);
          this.loading = false;
          return;
        }

        // In online mode, fetch from server
        try {
          const response = await axios.post(import.meta.env.VITE_GRAPHQL_URL, {
            query: `
              query GetContacts($pagination: PaginationInput) {
                contacts(pagination: $pagination) {
                  contacts {
                    id
                    name
                    phone
                    photo
                    createdAt
                    updatedAt
                  }
                  page
                  limit
                  pages
                  total
                }
              }
            `,
            variables: {
              pagination: {
                page: this.currentPage,
                limit: this.pageSize,
                sortBy: this.sortBy,
                sortOrder: this.sortOrder,
                search: this.search,
              },
            },
          });

          if (response.data?.errors) {
            throw new Error(response.data.errors[0].message);
          }

          const { contacts, pages, total } = response.data.data.contacts;
          
          // Save to existingContacts in sessionStorage
          this.saveToSessionStorage("existingContacts", contacts);
          
          // Update state
          this.contacts = loadMore ? [...this.contacts, ...contacts] : contacts;
          this.hasMore = this.currentPage < pages;
          this.totalPages = pages;

        } catch (error) {
          console.error("Network error:", error);
          // If API call fails, use cached data
          const existingContacts = this.getFromSessionStorage("existingContacts", []);
          this.contacts = this.sortAndFilterContacts([...pendingContacts, ...existingContacts]);
          throw error;
        }
      } catch (error) {
        console.error("Fetch error:", error);
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },

    async loadMoreContacts() {
      if (this.loadingMore || !this.hasMore) return;
      
      try {
        this.loadingMore = true;
        const nextPage = this.currentPage + 1;

        // Check cache first
        const cacheKey = this.getCacheKey(
          nextPage,
          this.pageSize,
          this.sortBy,
          this.sortOrder,
          this.search
        );
        const cachedData = this.getCacheData(cacheKey);

        if (cachedData) {
          this.contacts = [...this.contacts, ...cachedData.contacts];
          this.currentPage = nextPage;
          this.hasMore = nextPage < cachedData.pages;
          this.totalPages = cachedData.pages;
          return;
        }

        // Set next page before fetching
        this.currentPage = nextPage;
        await this.fetchContacts(true);

      } catch (error) {
        console.error("Error loading more contacts:", error);
        this.error = error.message;
      } finally {
        this.loadingMore = false;
      }
    },

    async getContactById(id) {
      // First check in current contacts and pending contacts
      const contact = [...this.contacts, ...this.pendingContacts].find(c => c.id === id);
      if (contact) return contact;

      // Then check in cache
      if (this.contactsCache.has(`contact-${id}`)) {
        return this.contactsCache.get(`contact-${id}`).data;
      }

      try {
        const response = await axios.post(import.meta.env.VITE_GRAPHQL_URL, {
          query: `
            query GetContact($id: ID!) {
              contact(id: $id) {
                id
                name
                phone
                photo
                createdAt
                updatedAt
              }
            }
          `,
          variables: { id },
        });

        if (response.data?.errors) {
          throw new Error(response.data.errors[0].message);
        }

        const contact = response.data.data.contact;
        
        // Cache the result
        this.setCacheData(`contact-${id}`, contact);
        return contact;
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    // ===== Sorting and Filtering =====
    setSearch: debounce(function(value) {
      try {
        this.search = value;
        this.saveToSessionStorage("contactSearch", value);
        
        if (this.isOffline) {
          // Just sort and filter the current contacts
          const allContacts = [...this.pendingContacts, ...this.getFromSessionStorage("existingContacts", [])];
          this.contacts = this.sortAndFilterContacts(allContacts);
        } else {
          // Reset to first page and fetch with new search
          this.currentPage = 1;
          this.fetchContacts();
        }
      } catch (error) {
        console.error('Search error:', error);
        this.error = error.message;
      }
    }, 300),

    setSort: debounce(function(field, order) {
      this.sortBy = field;
      this.sortOrder = order;
      sessionStorage.setItem("contactSortBy", field);
      sessionStorage.setItem("contactSortOrder", order);

      if (this.isOffline) {
        // Just sort the current contacts
        this.contacts = this.sortAndFilterContacts(this.contacts);
      } else {
        // Reset to first page and fetch with new sort
        this.currentPage = 1;
        this.fetchContacts();
      }
    }, 300),

    sortAndFilterContacts(contacts) {
      let filteredContacts = [...contacts];

      // Apply search filter
      if (this.search) {
        const searchTerm = this.search.toLowerCase();
        filteredContacts = filteredContacts.filter(
          (contact) =>
            contact.name.toLowerCase().includes(searchTerm) ||
            contact.phone.toLowerCase().includes(searchTerm)
        );
      }

      // Sort the filtered results
      return filteredContacts.sort((a, b) => {
        const aValue = (a[this.sortBy] || "").toString().toLowerCase();
        const bValue = (b[this.sortBy] || "").toString().toLowerCase();
        const compareResult = aValue.localeCompare(bValue);
        return this.sortOrder === "asc" ? compareResult : -compareResult;
      });
    },

    // ===== Contact Operations =====
    async addContact(contactData) {
      try {
        if (!navigator.onLine) {
          return this.addContactOffline(contactData);
        }

        // Only send required fields
        const { name, phone } = contactData;
        
        const response = await axios.post(import.meta.env.VITE_GRAPHQL_URL, {
          query: `
            mutation CreateContact($input: ContactInput!) {
              createContact(input: $input) {
                id
                name
                phone
                photo
                createdAt
                updatedAt
              }
            }
          `,
          variables: { 
            input: { name, phone }
          },
        });

        if (response.data?.errors) {
          throw new Error(response.data.errors[0].message || "Failed to create contact");
        }

        const newContact = response.data.data.createContact;
        this.clearCache();
        this.contacts = this.sortAndFilterContacts([...this.contacts, newContact]);
        
        return newContact;
      } catch (error) {
        console.error("Add contact error:", error);
        
        if (error.message.includes('Network Error') || !navigator.onLine) {
          return this.addContactOffline(contactData);
        }
        
        this.error = error.message;
        throw error;
      }
    },

    async addContactOffline(contactData) {
      const pendingContact = {
        ...contactData,
        id: `pending_${Date.now()}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        photo: contactData.photo || null
      };

      try {
        // Add to pending contacts
        this.pendingContacts.push(pendingContact);
        this.savePendingContacts();
        
        // Add to current contacts and resort
        this.contacts = this.sortAndFilterContacts([...this.contacts, pendingContact]);
        
        return pendingContact;
      } catch (error) {
        console.error('Error saving contact offline:', error);
        this.error = "Failed to save contact offline";
        throw new Error('Failed to save contact offline');
      }
    },

    async updateContact(id, contactData) {
      try {
        // Check for pending contact
        const isPending = id.startsWith("pending_");
        
        if (isPending || !navigator.onLine) {
          return this.updateContactOffline(id, contactData);
        }

        const mutation = `
          mutation UpdateContact($id: ID!, $input: ContactInput!) {
            updateContact(id: $id, input: $input) {
              id
              name
              phone
              photo
              createdAt
              updatedAt
            }
          }
        `;

        const response = await axios.post(import.meta.env.VITE_GRAPHQL_URL, {
          query: mutation,
          variables: { id, input: contactData },
        });

        if (response.data?.errors) {
          throw new Error(response.data.errors[0].message || "Failed to update contact");
        }

        const updatedContact = response.data.data.updateContact;
        
        // Update in contacts list
        const index = this.contacts.findIndex((c) => c.id === id);
        if (index !== -1) {
          this.contacts[index] = updatedContact;
        }
        
        // Clear caches
        this.clearCache();
        this.contactsCache.delete(`contact-${id}`);
        
        return updatedContact;
      } catch (error) {
        console.error("Update contact error:", error);
        
        // If network error, update offline
        if (error.message.includes('Network Error') || !navigator.onLine) {
          return this.updateContactOffline(id, contactData);
        }
        
        this.error = error.message;
        throw error;
      }
    },

    updateContactOffline(id, contactData) {
      try {
        // Find if it's in pending contacts
        const pendingIndex = this.pendingContacts.findIndex(c => c.id === id);
        
        if (pendingIndex !== -1) {
          // Update in pending contacts
          const updatedContact = {
            ...this.pendingContacts[pendingIndex],
            ...contactData,
            updatedAt: new Date().toISOString(),
            status: 'pending'
          };
          
          this.pendingContacts[pendingIndex] = updatedContact;
          this.savePendingContacts();
          
          // Update in current contacts list
          const contactIndex = this.contacts.findIndex(c => c.id === id);
          if (contactIndex !== -1) {
            this.contacts[contactIndex] = updatedContact;
          }
          
          return updatedContact;
        } else {
          // It's a server contact that needs to be added to pending
          const contact = this.contacts.find(c => c.id === id);
          
          if (!contact) {
            throw new Error("Contact not found");
          }
          
          // Create a pending version with original ID (for sync later)
          const pendingContact = {
            ...contact,
            ...contactData,
            originalId: id,
            id: `pending_update_${Date.now()}`,
            status: 'pending-update',
            updatedAt: new Date().toISOString()
          };
          
          // Add to pending contacts
          this.pendingContacts.push(pendingContact);
          this.savePendingContacts();
          
          // Update in current list
          const contactIndex = this.contacts.findIndex(c => c.id === id);
          if (contactIndex !== -1) {
            this.contacts[contactIndex] = {
              ...contact,
              ...contactData,
              status: 'pending-update'
            };
          }
          
          return pendingContact;
        }
      } catch (error) {
        console.error("Update contact offline error:", error);
        this.error = "Failed to update contact offline";
        throw new Error("Failed to update contact offline");
      }
    },

    async deleteContact(id) {
      try {
        const isPending = id.startsWith("pending_");
        
        if (isPending) {
          // Remove from pending contacts
          this.pendingContacts = this.pendingContacts.filter(c => c.id !== id);
          this.savePendingContacts();
          
          // Remove from current contacts list
          this.contacts = this.contacts.filter(c => c.id !== id);
          
          return { id };
        }
        
        if (!navigator.onLine) {
          // Mark for deletion when back online
          const contact = this.contacts.find(c => c.id === id);
          if (contact) {
            const pendingDelete = {
              ...contact,
              originalId: id,
              id: `pending_delete_${Date.now()}`,
              status: 'pending-delete'
            };
            
            // Add to pending contacts
            this.pendingContacts.push(pendingDelete);
            this.savePendingContacts();
          }
          
          // Remove from current list
          this.contacts = this.contacts.filter(c => c.id !== id);
          
          return { id };
        }

        // Online delete
        const mutation = `
          mutation DeleteContact($id: ID!) {
            deleteContact(id: $id) {
              id
            }
          }
        `;

        const response = await axios.post(import.meta.env.VITE_GRAPHQL_URL, {
          query: mutation,
          variables: { id },
        });

        if (response.data?.errors) {
          throw new Error(response.data.errors[0].message || "Failed to delete contact");
        }

        // Remove from contacts list
        this.contacts = this.contacts.filter(c => c.id !== id);
        
        // Clear caches
        this.clearCache();
        this.contactsCache.delete(`contact-${id}`);
        
        return { id };
      } catch (error) {
        console.error("Delete contact error:", error);
        this.error = error.message;
        throw error;
      }
    },

    async updateAvatar(id, formData) {
      try {
        // Convert FormData to base64 string
        const file = formData.get("photo");
        const base64String = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });

        // For pending contacts or offline mode
        if (id.startsWith("pending_") || !navigator.onLine) {
          return this.updateContact(id, { photo: base64String });
        }

        const mutation = `
          mutation UpdateAvatar($id: ID!, $photo: String!) {
            updateAvatar(id: $id, photo: $photo) {
              id
              name
              phone
              photo
              createdAt
              updatedAt
            }
          }
        `;

        const response = await axios.post(import.meta.env.VITE_GRAPHQL_URL, {
          query: mutation,
          variables: {
            id,
            photo: base64String,
          },
        });

        if (!response.data?.data?.updateAvatar) {
          throw new Error("Failed to update avatar");
        }

        const updatedContact = response.data.data.updateAvatar;
        
        // Update in contacts list
        const index = this.contacts.findIndex(c => c.id === id);
        if (index !== -1) {
          this.contacts[index] = updatedContact;
        }
        
        // Clear caches
        this.clearCache();
        this.contactsCache.delete(`contact-${id}`);
        
        return updatedContact;
      } catch (error) {
        console.error("Update avatar error:", error);
        
        // If network error, update offline
        if (error.message.includes('Network Error') || !navigator.onLine) {
          return this.updateContactOffline(id, { photo: base64String });
        }
        
        this.error = error.message;
        throw error;
      }
    },

    // ===== Sync Operations =====
    async syncPendingContacts() {
      if (this.isOffline || !this.pendingContacts.length) return;

      const BATCH_SIZE = 5;
      const pendingContacts = [...this.pendingContacts];
      const syncedIds = [];

      // Process in batches
      for (let i = 0; i < pendingContacts.length; i += BATCH_SIZE) {
        const batch = pendingContacts.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (contact) => {
            try {
              if (contact.status === 'pending-delete' && contact.originalId) {
                // Handle pending deletes
                await this.deleteContact(contact.originalId);
                syncedIds.push(contact.id);
              } else if (contact.status === 'pending-update' && contact.originalId) {
                // Handle pending updates
                const { originalId, id, status, ...contactData } = contact;
                await this.updateContact(originalId, contactData);
                syncedIds.push(contact.id);
              } else if (contact.id.startsWith("pending_")) {
                // Handle new contacts
                const { id, status, createdAt, updatedAt, originalId, ...contactData } = contact;
                await this.addContact(contactData);
                syncedIds.push(contact.id);
              }
            } catch (error) {
              console.error("Failed to sync contact:", error);
              // Keep in pending if failed
            }
          })
        );
      }

      // Remove synced contacts from pending
      this.pendingContacts = this.pendingContacts.filter(c => !syncedIds.includes(c.id));
      this.savePendingContacts();
      
      // Refresh contacts
      await this.resetAndFetchContacts();
    },

    async resendPendingContact(pendingId) {
      if (!this.checkConnection()) {
        throw new Error("No internet connection available");
      }

      const pendingContact = this.pendingContacts.find(c => c.id === pendingId);
      if (!pendingContact) {
        throw new Error("Pending contact not found");
      }

      try {
        let result;
        
        if (pendingContact.status === 'pending-delete' && pendingContact.originalId) {
          result = await this.deleteContact(pendingContact.originalId);
        } else if (pendingContact.status === 'pending-update' && pendingContact.originalId) {
          // Remove fields not in ContactInput type
          const { originalId, id, status, createdAt, updatedAt, photo, ...contactData } = pendingContact;
          result = await this.updateContact(originalId, contactData);
        } else {
          // Handle new contacts - only send name and phone
          const { name, phone } = pendingContact;
          result = await this.addContact({ name, phone });
        }

        // Remove from pending contacts
        this.pendingContacts = this.pendingContacts.filter(c => c.id !== pendingId);
        this.savePendingContacts();
        
        // Refresh contacts
        await this.resetAndFetchContacts();
        
        return result;
      } catch (error) {
        console.error("Failed to resend contact:", error);
        this.error = error.message;
        throw error;
      }
    },

    // ===== Reset and Refresh =====
    async resetAndFetchContacts() {
      this.currentPage = 1;
      this.hasMore = true;
      this.clearCache();
      
      // Don't clear existingContacts when offline
      if (navigator.onLine) {
        sessionStorage.removeItem("existingContacts");
      }
      
      await this.fetchContacts();
    },

    clearError() {
      this.error = null;
    }
  },
});