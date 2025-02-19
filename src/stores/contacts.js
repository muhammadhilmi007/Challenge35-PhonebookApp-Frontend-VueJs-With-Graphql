import { defineStore } from 'pinia'
import axios from 'axios'

export const useContactStore = defineStore('contacts', {
  state: () => ({
    contacts: [],
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
    // Add this fetchContacts method
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

        const { contacts, pages } = response.data.data.contacts;
        
        if (this.currentPage === 1) {
          this.contacts = contacts;
        } else {
          this.contacts = [...this.contacts, ...contacts];
        }
        
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

    async updateAvatar(id, photo) {
      try {
        const mutation = `
          mutation UpdateAvatar($id: ID!, $photo: String!) {
            updateAvatar(id: $id, photo: $photo) {
              id
              photo
            }
          }
        `

        const response = await axios.post(import.meta.env.VITE_GRAPHQL_URL, {
          query: mutation,
          variables: { id, photo }
        })

        const updatedContact = response.data.data.updateAvatar
        const index = this.contacts.findIndex(c => c.id === id)
        if (index !== -1) {
          this.contacts[index].photo = updatedContact.photo
        }
        return updatedContact
      } catch (error) {
        this.error = error.message
        throw error
      }
    },

    async loadMoreContacts() {
      if (this.loading || !this.hasMore) return;
      
      this.currentPage += 1;
      this.loading = true;
      
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

        const { contacts, pages } = response.data.data.contacts;
        this.contacts = [...this.contacts, ...contacts];
        this.hasMore = this.currentPage < pages;
      } catch (error) {
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },

    setSearchTerm(term) {
      this.searchTerm = term
      this.currentPage = 1
      this.fetchContacts()
    },

    setSortOrder(order) {
      this.sortOrder = order
      this.fetchContacts()
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
