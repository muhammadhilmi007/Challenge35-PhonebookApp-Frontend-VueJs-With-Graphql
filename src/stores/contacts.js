import { defineStore } from "pinia";
import axios from "axios";
import { debounce } from "lodash-es"; // Add this import
import { useSessionStorage } from '@vueuse/core';

export const useContactStore = defineStore("contacts", {
  state: () => ({
    contacts: [],
    contactCache: new Map(),
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
    contactsCache: new Map(), // Add cache for paginated results
    cacheDuration: 5 * 60 * 1000, // 5 minutes cache duration
    _sortedContacts: null,
    _lastSortUpdate: null,
  }),

  getters: {
    sortedAndFilteredContacts: (state) => {
      const allContacts = [...state.pendingContacts, ...state.contacts];

      // Memoize sorted contacts
      if (
        !state._sortedContacts ||
        state._lastSortUpdate !== state.sortOrder + state.sortBy
      ) {
        state._sortedContacts = [...allContacts].sort((a, b) => {
          const aValue = (a[state.sortBy] || "").toString().toLowerCase();
          const bValue = (b[state.sortBy] || "").toString().toLowerCase();
          const compareResult = aValue.localeCompare(bValue);
          return state.sortOrder === "asc" ? compareResult : -compareResult;
        });
        state._lastSortUpdate = state.sortOrder + state.sortBy;
      }

      // Apply search filter if active
      if (state.search) {
        const searchTerm = state.search.toLowerCase();
        return state._sortedContacts.filter(
          (contact) =>
            contact.name.toLowerCase().includes(searchTerm) ||
            contact.phone.toLowerCase().includes(searchTerm)
        );
      }

      return state._sortedContacts;
    },
  },

  actions: {
    // Add cache helper methods
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

    // Modified fetchContacts with improved caching
    async fetchContacts(loadMore = false) {
      if (this.loading) return;
      this.error = null;
      this.loading = true;

      try {
        const page = loadMore ? this.currentPage + 1 : 1;
        const limit = 10;

        // Clear cache if not loading more
        if (!loadMore) {
          this.contactsCache.clear();
        }

        // Check cache first
        const cacheKey = this.getCacheKey(
          page,
          limit,
          this.sortBy,
          this.sortOrder,
          this.search
        );
        const cachedData = this.getCacheData(cacheKey);

        if (cachedData) {
          const { contacts, pages } = cachedData;
          this.contacts = loadMore ? [...this.contacts, ...contacts] : contacts;
          this.hasMore = page < pages;
          this.currentPage = page;
          this.totalPages = pages;
          this.loading = false;
          return;
        }

        // Get cached data
        const pendingContacts = JSON.parse(
          sessionStorage.getItem("pendingContacts") || "[]"
        );
        const existingContacts = JSON.parse(
          sessionStorage.getItem("existingContacts") || "[]"
        );

        try {
          console.log("Fetching Contacts", response);
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
                page,
                limit,
                sortBy: this.sortBy,
                sortOrder: this.sortOrder,
                search: this.search,
              },
            },
          });

          const { contacts, pages } = response.data.data.contacts;

          // Save to sessionStorage
          if (!loadMore) {
            sessionStorage.setItem(
              "existingContacts",
              JSON.stringify(contacts)
            );
          } else {
            sessionStorage.setItem(
              "existingContacts",
              JSON.stringify([...existingContacts, ...contacts])
            );
          }

          // Update state
          this.contacts = loadMore ? [...this.contacts, ...contacts] : contacts;
          this.hasMore = page < pages;
          this.currentPage = page;
          this.isOffline = false;
          this.totalPages = pages;
        } catch (error) {
          console.log("Server unavailable, using sessionStorage data");

          const allContacts = [...pendingContacts, ...existingContacts];
          const sortedContacts = this.sortAndFilterContacts(allContacts);

          if (!loadMore) {
            // Initial load in offline mode
            const initialBatch = sortedContacts.slice(0, limit);
            this.contacts = initialBatch;

            // Store remaining for infinite scroll
            sessionStorage.setItem(
              "remainingOfflineContacts",
              JSON.stringify(sortedContacts.slice(limit))
            );

            this.hasMore = sortedContacts.length > limit;
          } else {
            // Handle infinite scroll in offline mode
            const remainingContacts = JSON.parse(
              sessionStorage.getItem("remainingOfflineContacts") || "[]"
            );

            if (remainingContacts.length > 0) {
              const nextBatch = remainingContacts.slice(0, limit);
              const newRemaining = remainingContacts.slice(limit);

              this.contacts = [...this.contacts, ...nextBatch];

              sessionStorage.setItem(
                "remainingOfflineContacts",
                JSON.stringify(newRemaining)
              );

              this.hasMore = newRemaining.length > 0;
              this.currentPage = page;
            } else {
              this.hasMore = false;
            }
          }

          this.isOffline = true;
        }
      } catch (error) {
        this.error = error.message;
        console.error("Failed to load contacts:", error);
      } finally {
        this.loading = false;
      }
    },

    setOnlineStatus(status) {
      this.isOffline = !status;
      if (status) {
        this.syncPendingContacts();
      }
    },

    clearError() {
      this.error = null;
    },

    async syncPendingContacts() {
      if (this.isOffline || !this.pendingContacts.length) return;

      const BATCH_SIZE = 5;
      const pendingContacts = [...this.pendingContacts];
      this.pendingContacts = [];

      // Process in batches
      for (let i = 0; i < pendingContacts.length; i += BATCH_SIZE) {
        const batch = pendingContacts.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (contact) => {
            try {
              if (contact.id.startsWith("pending_")) {
                await this.addContact(contact);
              } else {
                await this.updateContact(contact.id, contact);
              }
            } catch (error) {
              this.pendingContacts.push(contact);
              console.error("Failed to sync contact:", error);
            }
          })
        );
      }

      this.savePendingContacts();
      await this.fetchContacts();
    },
    // Offline support methods
    checkConnection() {
      this.isOffline = !navigator.onLine;
      return !this.isOffline;
    },

    savePendingContacts() {
      sessionStorage.setItem(
        "pendingContacts",
        JSON.stringify(this.pendingContacts)
      );
    },

    saveToSessionStorage(contacts) {
      sessionStorage.setItem("cachedContacts", JSON.stringify(contacts));
      sessionStorage.setItem("lastFetchTime", Date.now().toString());
    },

    getFromSessionStorage() {
      const cached = sessionStorage.getItem("cachedContacts");
      return cached ? JSON.parse(cached) : null;
    },

    batchSaveToSessionStorage(items) {
      const updates = {};
      for (const [key, value] of Object.entries(items)) {
        updates[key] = JSON.stringify(value);
      }

      // Batch all sessionStorage updates
      Object.entries(updates).forEach(([key, value]) => {
        sessionStorage.setItem(key, value);
      });
    },

    // Use in setSort
    setSort(field, order) {
      this.sortBy = field;
      this.sortOrder = order;

      // Batch sessionStorage updates
      this.batchSaveToSessionStorage({
        contactSortBy: field,
        contactSortOrder: order,
      });

      this.currentPage = 1;
      this.fetchContacts();
    },

    // Search and sort methods
    setSearchTerm(term) {
      this.search = term;
      sessionStorage.setItem("contactSearch", term);
      sessionStorage.setItem("searchActive", "true");
      this.currentPage = 1;
      this.fetchContacts();
    },

    setSortOrder(order) {
      this.sortOrder = order;
      sessionStorage.setItem("contactSortOrder", order);
      this.currentPage = 1;
      this.fetchContacts();
    },

    sortAndFilterContacts(contacts) {
      // Sort contacts
      const sortedContacts = [...contacts].sort((a, b) => {
        const aValue = (a[this.sortBy] || "").toString().toLowerCase();
        const bValue = (b[this.sortBy] || "").toString().toLowerCase();
        const compareResult = aValue.localeCompare(bValue);
        return this.sortOrder === "asc" ? compareResult : -compareResult;
      });

      // Apply search if active
      if (this.search) {
        const searchTerm = this.search.toLowerCase();
        return sortedContacts.filter(
          (contact) =>
            contact.name.toLowerCase().includes(searchTerm) ||
            contact.phone.toLowerCase().includes(searchTerm)
        );
      }

      return sortedContacts;
    },

    // Improved search method with debouncing
    setSearch: debounce(function (value) {
      this.search = value;
      if (value) {
        sessionStorage.setItem("contactSearch", value);
        sessionStorage.setItem("searchActive", "true");
      } else {
        sessionStorage.removeItem("contactSearch");
        sessionStorage.removeItem("searchActive");
      }
      this.currentPage = 1;
      this.fetchContacts();
    }, 300),

    // Improved sort method with debouncing
    setSort: debounce(function (field, order) {
      this.sortBy = field;
      this.sortOrder = order;
      sessionStorage.setItem("contactSortBy", field);
      sessionStorage.setItem("contactSortOrder", order);
      this.currentPage = 1;
      this.fetchContacts();
    }, 300),

    // Modified addContact with offline support
    async addContact(contactData) {
      try {
        if (!this.checkConnection()) {
          const pendingContact = {
            ...contactData,
            id: `pending_${Date.now()}`,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Update pending contacts in state and storage
          this.pendingContacts.push(pendingContact);
          this.savePendingContacts();

          // Add to current contacts list and sort
          this.contacts = [...this.contacts, pendingContact];
          this.contacts = this.sortAndFilterContacts(this.contacts);

          return pendingContact;
        }

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
          variables: { input: contactData },
        });

        return response.data.data.createContact;
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    // Modified resendPendingContact method
    async resendPendingContact(pendingId) {
      if (!this.checkConnection()) {
        throw new Error("No internet connection available");
      }

      const pendingContact = this.pendingContacts.find(
        (c) => c.id === pendingId
      );
      if (!pendingContact) return;

      try {
        const { id, status, createdAt, updatedAt, ...contactData } =
          pendingContact;
        const savedContact = await this.addContact(contactData);

        // Remove from pending and add to regular contacts
        this.pendingContacts = this.pendingContacts.filter(
          (c) => c.id !== pendingId
        );
        this.savePendingContacts();

        return savedContact;
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    removeFromCurrentView(contactId) {
      // Using Set for faster lookup
      const contactsSet = new Set(this.contacts.map((c) => c.id));
      contactsSet.delete(contactId);
      this.contacts = this.contacts.filter((contact) =>
        contactsSet.has(contact.id)
      );
    },

    async updateContact(id, contactData) {
      try {
        const mutation = `
          mutation UpdateContact($id: ID!, $input: ContactInput!) {
            updateContact(id: $id, input: $input) {
              id
              name
              phone
              photo
            }
          }
        `;

        const response = await axios.post(import.meta.env.VITE_GRAPHQL_URL, {
          query: mutation,
          variables: { id, input: contactData },
        });

        const updatedContact = response.data.data.updateContact;

        // Update local state considering search term
        const searchTerm = this.search.toLowerCase();
        if (searchTerm) {
          const matchesSearch =
            updatedContact.name.toLowerCase().includes(searchTerm) ||
            updatedContact.phone.toLowerCase().includes(searchTerm);

          if (!matchesSearch) {
            this.removeFromCurrentView(id);
          } else {
            const index = this.contacts.findIndex((c) => c.id === id);
            if (index !== -1) {
              this.contacts[index] = updatedContact;
            }
          }
        } else {
          const index = this.contacts.findIndex((c) => c.id === id);
          if (index !== -1) {
            this.contacts[index] = updatedContact;
          }
        }

        return updatedContact;
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    setSearchTerm(term) {
      this.search = term;
      this.currentPage = 1;
      this.fetchContacts(); // Immediately fetch contacts with new search term
    },

    setSortOrder(order) {
      this.sortOrder = order;
      this.currentPage = 1; // Reset to first page when sorting changes
      this.fetchContacts(); // This will maintain the current search term
    },

    async getContactById(id) {
      if (this.contactCache.has(id)) {
        return this.contactCache.get(id);
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

        if (response.data.errors) {
          throw new Error(response.data.errors[0].message);
        }

        const contact = response.data.data.contact;
        // Cache the result
        this.contactCache.set(id, contact);
        return contact;
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    async fetchContacts() {
      if (this.loading) return;
      this.error = null;

      try {
        this.loading = true;
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
              limit: 10,
              sortBy: this.sortBy,
              sortOrder: this.sortOrder,
              search: this.search,
            },
          },
        });

        if (response.data.errors) {
          throw new Error(response.data.errors[0].message);
        }

        const { contacts, pages } = response.data.data.contacts;
        this.contacts =
          this.currentPage === 1 ? contacts : [...this.contacts, ...contacts];
        this.hasMore = this.currentPage < pages;
      } catch (error) {
        this.error = error.message;
        console.error("Error fetching contacts:", error);
      } finally {
        this.loading = false;
      }
    },

    // Add this new method
    async addPendingContact(contactData) {
      try {
        const pendingContact = {
          ...contactData,
          id: `pending-${Date.now()}`, // Temporary ID
          status: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Add to pending contacts
        this.contacts.unshift(pendingContact);

        // Try to save to server
        try {
          const savedContact = await this.addContact(contactData);
          // Replace pending with saved
          const index = this.contacts.findIndex(
            (c) => c.id === pendingContact.id
          );
          if (index !== -1) {
            this.contacts[index] = savedContact;
          }
          return savedContact;
        } catch (error) {
          // Keep as pending if server save fails
          console.error("Failed to save contact:", error);
          return pendingContact;
        }
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    // Update existing addContact method
    async addContact(contactData) {
      try {
        const mutation = `
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
        `;

        const response = await axios.post(import.meta.env.VITE_GRAPHQL_URL, {
          query: mutation,
          variables: { input: contactData },
        });

        const newContact = response.data.data.createContact;
        return newContact;
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    async updateContact(id, contactData) {
      try {
        const mutation = `
          mutation UpdateContact($id: ID!, $input: ContactInput!) {
            updateContact(id: $id, input: $input) {
              id
              name
              phone
              photo
            }
          }
        `;

        const response = await axios.post(import.meta.env.VITE_GRAPHQL_URL, {
          query: mutation,
          variables: { id, input: contactData },
        });

        const updatedContact = response.data.data.updateContact;
        const index = this.contacts.findIndex((c) => c.id === id);
        if (index !== -1) {
          this.contacts[index] = updatedContact;
        }
        return updatedContact;
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    async deleteContact(id) {
      try {
        const mutation = `
          mutation DeleteContact($id: ID!) {
            deleteContact(id: $id) {
              id
            }
          }
        `;

        await axios.post(import.meta.env.VITE_GRAPHQL_URL, {
          query: mutation,
          variables: { id },
        });

        this.contacts = this.contacts.filter((c) => c.id !== id);
      } catch (error) {
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
          console.error("Server response:", response.data);
          throw new Error("Failed to update avatar");
        }

        const updatedContact = response.data.data.updateAvatar;
        const index = this.contacts.findIndex((c) => c.id === id);
        if (index !== -1) {
          this.contacts[index] = updatedContact;
        }
        return updatedContact;
      } catch (error) {
        console.error("Update avatar error:", error);
        this.error = error.message;
        throw error;
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
          this.appendContacts(cachedData.contacts);
          this.updatePagination(nextPage, cachedData.pages);
          return;
        }

        const response = await this.fetchPageFromServer(nextPage);
        const { contacts, pages } = response;

        this.appendContacts(contacts);
        this.updatePagination(nextPage, pages);

        // Cache the results
        this.setCacheData(cacheKey, { contacts, pages });
      } catch (error) {
        console.error("Error loading more contacts:", error);
        this.error = error.message;
      } finally {
        this.loadingMore = false;
      }
    },

    async fetchPageFromServer(page) {
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
            page,
            limit: this.pageSize,
            sortBy: this.sortBy,
            sortOrder: this.sortOrder,
            search: this.search,
          },
        },
      });

      return response.data.data.contacts;
    },

    // Add these new methods in the actions object
    async resetAndFetchContacts() {
      this.contacts = [];
      this.currentPage = 1;
      this.hasMore = true;
      this.contactsCache.clear();
      sessionStorage.removeItem("existingContacts");
      sessionStorage.removeItem("remainingOfflineContacts");
      await this.fetchContacts();
    },

    handleContactUpdate(updatedContact) {
      const index = this.contacts.findIndex((c) => c.id === updatedContact.id);
      if (index !== -1) {
        // Update contact in the current list
        const index = this.contacts.findIndex(
          (c) => c.id === updatedContact.id
        );
        if (index !== -1) {
          this.contacts[index] = updatedContact;
        }

        // Re-sort the contacts based on current sort settings
        this.contacts = this.sortAndFilterContacts(this.contacts);

        // Clear cache to ensure fresh data on next fetch
        this.contactsCache.clear();
        sessionStorage.removeItem("existingContacts");
      }
    },

    async updateContact(id, contactData) {
      try {
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

        const updatedContact = response.data.data.updateContact;

        // Handle the update and re-sort
        await this.handleContactUpdate(updatedContact);

        return updatedContact;
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    appendContacts(newContacts) {
      this.contacts = [...this.contacts, ...newContacts];
    },

    // Helper method to update pagination
    updatePagination(page, totalPages) {
      this.currentPage = page;
      this.hasMore = page < totalPages;
      this.totalPages = totalPages;
    },

    setPage(page) {
      this.currentPage = page;
      this.fetchContacts();
    },

    updateSearch(value) {
      this.search = value;
    },

    // Add this new method
    async resendPendingContact(pendingId) {
      try {
        if (!this.checkConnection()) {
          throw new Error("Server is currently offline. Please try again when online.");
        }

        const pendingContact = this.contacts.find(c => c.id === pendingId);
        if (!pendingContact) return;

        // Remove status and temporary id for sending to server
        const { id, status, ...contactData } = pendingContact;

        // Try to create contact on server
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
          variables: { input: contactData },
        });

        const savedContact = response.data.data.createContact;

        // Remove from session storage
        const pendingContacts = JSON.parse(sessionStorage.getItem('pendingContacts') || '[]');
        const updatedPending = pendingContacts.filter(c => c.id !== pendingId);
        sessionStorage.setItem('pendingContacts', JSON.stringify(updatedPending));

        // Update the contact in the current list
        const index = this.contacts.findIndex(c => c.id === pendingId);
        if (index !== -1) {
          this.contacts[index] = savedContact;
        }

        // Refresh the list to ensure proper order
        await this.resetAndFetchContacts();

        return savedContact;
      } catch (error) {
        if (!navigator.onLine) {
          throw new Error("No internet connection. Please check your connection and try again.");
        }
        throw error;
      }
    },
  },
});
