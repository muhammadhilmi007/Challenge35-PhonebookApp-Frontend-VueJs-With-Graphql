import { defineStore } from 'pinia'
import axios from 'axios'

export const useContactStore = defineStore('contacts', {
  state: () => ({
    contacts: [],
    contactCache: new Map(),
    search: '',
    sortOrder: 'asc',
    sortBy: 'name',
    currentPage: 1,
    loading: false,
    hasMore: true,
    error: null,
    isOffline: false,
    pendingContacts: [] // Add this for pending contacts
  }),

  getters: {
    filteredContacts: (state) => {
      return state.contacts // Server-side filtering is handled by GraphQL
    }
  },

  actions: {

    removeFromCurrentView(contactId) {
      this.contacts = this.contacts.filter(contact => contact.id !== contactId);
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
          variables: { id, input: contactData }
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
            const index = this.contacts.findIndex(c => c.id === id);
            if (index !== -1) {
              this.contacts[index] = updatedContact;
            }
          }
        } else {
          const index = this.contacts.findIndex(c => c.id === id);
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
          variables: { id }
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
      this.loading = true;
      this.error = null;

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
              limit: 10,
              sortBy: this.sortBy,
              sortOrder: this.sortOrder,
              search: this.search
            }
          }
        });

        if (response.data.errors) {
          throw new Error(response.data.errors[0].message);
        }

        const { contacts, pages } = response.data.data.contacts;
        this.contacts = this.currentPage === 1 ? contacts : [...this.contacts, ...contacts];
        this.hasMore = this.currentPage < pages;
      } catch (error) {
        this.error = error.message;
        console.error('Error fetching contacts:', error);
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
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Add to pending contacts
        this.contacts.unshift(pendingContact);

        // Try to save to server
        try {
          const savedContact = await this.addContact(contactData);
          // Replace pending with saved
          const index = this.contacts.findIndex(c => c.id === pendingContact.id);
          if (index !== -1) {
            this.contacts[index] = savedContact;
          }
          return savedContact;
        } catch (error) {
          // Keep as pending if server save fails
          console.error('Failed to save contact:', error);
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
          variables: { input: contactData }
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
        `

        const response = await axios.post(import.meta.env.VITE_GRAPHQL_URL, {
          query: mutation,
          variables: { id, input: contactData }
        })

        const updatedContact = response.data.data.updateContact
        const index = this.contacts.findIndex(c => c.id === id)
        if (index !== -1) {
          this.contacts[index] = updatedContact
        }
        return updatedContact
      } catch (error) {
        this.error = error.message
        throw error
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
        `

        await axios.post(import.meta.env.VITE_GRAPHQL_URL, {
          query: mutation,
          variables: { id }
        })

        this.contacts = this.contacts.filter(c => c.id !== id)
      } catch (error) {
        this.error = error.message
        throw error
      }
    },

    async updateAvatar(id, formData) {
      try {
        // Convert FormData to base64 string
        const file = formData.get('photo');
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
            photo: base64String 
          }
        });

        if (!response.data?.data?.updateAvatar) {
          console.error('Server response:', response.data);
          throw new Error('Failed to update avatar');
        }

        const updatedContact = response.data.data.updateAvatar;
        const index = this.contacts.findIndex(c => c.id === id);
        if (index !== -1) {
          this.contacts[index] = updatedContact;
        }
        return updatedContact;
      } catch (error) {
        console.error('Update avatar error:', error);
        this.error = error.message;
        throw error;
      }
    },

    // Add these new methods in the actions object
    resetAndFetchContacts() {
      this.contacts = [];
      this.currentPage = 1;
      this.hasMore = true;
      this.fetchContacts();
    },

    async loadMoreContacts() {
      if (this.loading || !this.hasMore) return;
      
      this.loading = true;
      
      try {
        const nextPage = this.currentPage + 1;
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
              page: nextPage,
              limit: 10,
              sortBy: this.sortBy,
              sortOrder: this.sortOrder,
              search: this.search
            }
          }
        });

        const { contacts, pages } = response.data.data.contacts;
        
        // Append new contacts to existing list
        if (contacts && contacts.length > 0) {
          this.contacts = [...this.contacts, ...contacts];
          this.currentPage = nextPage;
          this.hasMore = nextPage < pages;
        } else {
          this.hasMore = false;
        }
      } catch (error) {
        this.error = error.message;
        console.error('Error loading more contacts:', error);
      } finally {
        this.loading = false;
      }
    },

    setPage(page) {
      this.currentPage = page
      this.fetchContacts()
    },

    updateSearch(value) {
      this.search = value
    },

    // Add this new method
    async resendPendingContact(pendingId) {
      const pendingContact = this.contacts.find(c => c.id === pendingId);
      if (!pendingContact) return;

      try {
        const { id, status, ...contactData } = pendingContact;
        const savedContact = await this.addContact(contactData);
        
        // Replace pending with saved
        const index = this.contacts.findIndex(c => c.id === pendingId);
        if (index !== -1) {
          this.contacts[index] = savedContact;
        }
        
        return savedContact;
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    }
  }
})
