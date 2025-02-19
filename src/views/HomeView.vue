<template>
  <div class="app">
    <SearchBar
      :value="search"
      @update:value="handleSearchChange"
      @sort="handleSortChange"
      @add="navigateToAdd"
    />
    <ContactList
      :contacts="contactStore.contacts"
      :loading="loading"
      :has-more="hasMore"
      @load-more="handleLoadMore"
      @edit="handleEditContact"
      @delete="handleDeleteContact"
      @avatar-update="navigateToAvatar"
      @resend-success="handleResendSuccess"
      @refresh-contacts="handleRefreshContacts"
    />
  </div>
</template>

<script>
import ContactList from "@/components/ContactList.vue";
import SearchBar from "@/components/SearchBar.vue";
import { ref, computed } from 'vue'
import { watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContactStore } from '../stores/contacts.js'

export default {
  components: { SearchBar, ContactList },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const contactStore = useContactStore()

    // Initialize search with empty string instead of undefined
    const search = ref('')

    // Load initial data
    onMounted(() => {
      contactStore.fetchContacts();
    });

    // Update the state management section
    const { loading, error, hasMore, isOffline, sortBy, sortOrder } = contactStore

    // Load contacts when search/sort changes
    watch(
      [() => sortBy, () => sortOrder, () => search],
      ([newSortBy, newSortOrder, newSearch], [oldSortBy, oldSortOrder, oldSearch]) => {
        if (
          newSortBy !== oldSortBy ||
          newSortOrder !== oldSortOrder ||
          newSearch !== oldSearch
        ) {
          try {
            contactStore.$patch({ currentPage: 1 })
            contactStore.fetchContacts()
          } catch (e) {
            console.error('Unhandled error during execution of watcher getter', e)
          }
        }
      },
      { immediate: true },
    )

    // Manage search parameters in session storage
    watch(
      () => route.query,
      (newQuery, oldQuery = {}) => {
        const sessionParams = ['search', 'sortBy', 'sortOrder']
        sessionParams.forEach((param) => {
          if (newQuery && newQuery[param]) {
            try {
              sessionStorage.setItem(
                `contact${param.charAt(0).toUpperCase() + param.slice(1)}`,
                newQuery[param],
              )
              if (param === 'search') sessionStorage.setItem('searchActive', 'true')
            } catch (e) {
              console.error('Unhandled error during execution of watcher getter', e)
            }
          } else if (oldQuery[param]) {
            try {
              sessionStorage.removeItem(
                `contact${param.charAt(0).toUpperCase() + param.slice(1)}`,
              )
              if (param === 'search') sessionStorage.removeItem('searchActive')
            } catch (e) {
              console.error('Unhandled error during execution of watcher getter', e)
            }
          }
        })
      },
      { immediate: true },
    )

    // Clean up session storage on page unload
    const cleanupStorage = () => {
      try {
        sessionStorage.removeItem('searchActive')
        sessionStorage.removeItem('contactSearch')
      } catch (e) {
        console.error('Unhandled error during execution of watcher getter', e)
      }
    }
    onMounted(() => window.addEventListener('beforeunload', cleanupStorage))
    onBeforeUnmount(() => window.removeEventListener('beforeunload', cleanupStorage))

    // Event handlers
    const handleSearchChange = (value) => {
      try {
        search.value = value || ''
        contactStore.updateSearch(value)
      } catch (error) {
        console.error('Error handling search change:', error)
      }
    }
    const handleSortChange = (field, order) =>
      contactStore.setSort({ sortBy: field, sortOrder: order })
    const handleEditContact = (id, updatedContact) =>
      contactStore.updateContact({ id, updatedContact })
    const handleDeleteContact = (id) => contactStore.deleteContact(id)
    const handleLoadMore = () => {
      if (isOffline.value) {
        const offlineContacts = JSON.parse(
          sessionStorage.getItem('offlineFilteredContacts') || '[]',
        )
        const startIndex = contacts.value.length
        const endIndex = startIndex + 10
        const nextBatch = offlineContacts.slice(startIndex, endIndex)
        if (nextBatch.length > 0) {
          try {
            contactStore.loadMoreContacts()
          } catch (e) {
            console.error('Unhandled error during execution of watcher getter', e)
          }
        }
      } else {
        try {
          contactStore.loadMoreContacts()
        } catch (e) {
          console.error('Unhandled error during execution of watcher getter', e)
        }
      }
    }
      try {
        contactStore.$reset()
        contactStore.$patch({ currentPage: 1 })
        contactStore.fetchContacts()
      } catch (e) {
        console.error('Unhandled error during execution of watcher getter', e)
    }
    const navigateToAdd = () => router.push('/add')
    const navigateToAvatar = (id) => router.push(`/avatar/${id}`)
    const handleResendSuccess = (pendingId, savedContact) =>
      contactStore.handleResendSuccess({ pendingId, savedContact })

    const handleRefreshContacts = () => {
      try {
        contactStore.$reset()
        contactStore.$patch({ currentPage: 1 })
        contactStore.fetchContacts()
      } catch (e) {
        console.error('Unhandled error during execution of watcher getter', e)
      }
    }

    return {
      contactStore, // Add this to access store in template
      contacts: computed(() => contactStore.contacts),
      loading: computed(() => contactStore.loading),
      error: computed(() => contactStore.error),
      hasMore: computed(() => contactStore.hasMore),
      isOffline: computed(() => contactStore.isOffline),
      search, // Make sure to return the search ref
      handleSearchChange,
      handleSortChange,
      handleEditContact,
      handleDeleteContact,
      handleLoadMore,
      handleRefreshContacts,
      navigateToAdd,
      navigateToAvatar,
      handleResendSuccess,
    }
  },
}
</script>

<style scoped>
.app {
  padding: 20px;
}
.loading {
  text-align: center;
  font-weight: bold;
  margin-top: 20px;
}
</style>

