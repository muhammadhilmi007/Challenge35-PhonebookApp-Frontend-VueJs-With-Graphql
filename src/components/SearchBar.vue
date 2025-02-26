<template>
  <div class="search-bar">
    <!-- Use v-memo for static button content -->
    <button 
      @click="handleSortClick" 
      class="sort-button"
      :aria-label="`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`"
      v-memo="[sortOrder]"
    >
      <FontAwesomeIcon :icon="sortOrder === 'asc' ? faSortAlphaDown : faSortAlphaUp" />
    </button>

    <div class="search-input-container">
      <!-- Memoize static icon -->
      <FontAwesomeIcon v-memo="[faSearch]" :icon="faSearch" class="search-icon" />
      <input
        type="text"
        placeholder="Search by name or phone..."
        v-model="searchValue"
        @input="debouncedSearchHandler"
        aria-label="Search contacts"
      />
    </div>

    <!-- Memoize static button -->
    <button 
      v-memo="[faUserPlus]"
      class="add-button" 
      @click="$emit('add')"
      aria-label="Add new contact"
    >
      <FontAwesomeIcon :icon="faUserPlus" />
    </button>
  </div>
</template>

<script>
import { computed, shallowRef, onMounted, watch, onBeforeUnmount } from 'vue';
import { useContactStore } from '../stores/contacts';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faSearch, faUserPlus, faSortAlphaDown, faSortAlphaUp } from '@fortawesome/free-solid-svg-icons';

export default {
  components: { FontAwesomeIcon },
  props: {
    value: {
      type: String,
      default: ''
    }
  },
  emits: ['update:value', 'add'],
  setup(props, { emit }) {
    const contactStore = useContactStore();
    // Use shallowRef for better performance
    const sortOrder = shallowRef(contactStore.sortOrder);
    const searchTimeout = shallowRef(null);
    const searchValue = shallowRef(contactStore.search || '');

    // Static icons object for better memory usage
    const icons = {
      search: faSearch,
      userPlus: faUserPlus,
      sortUp: faSortAlphaUp,
      sortDown: faSortAlphaDown
    };

    // Optimized watchers with immediate option
    watch(() => contactStore.search, (newValue) => {
      searchValue.value = newValue;
    }, { immediate: true });

    watch(() => props.value, (newValue) => {
      if (newValue !== searchValue.value) {
        searchValue.value = newValue;
      }
    }, { immediate: true });

    onMounted(() => {
      searchValue.value = contactStore.search;
      emit('update:value', contactStore.search);
    });
    
    const handleSortClick = () => {
      const newSortOrder = sortOrder.value === 'asc' ? 'desc' : 'asc';
      contactStore.setSort(contactStore.sortBy, newSortOrder);
    };

    // Optimized debounced search handler
    const debouncedSearchHandler = (event) => {
      const value = event.target.value;
      emit('update:value', value);
      
      if (searchTimeout.value) {
        clearTimeout(searchTimeout.value);
      }
      
      searchTimeout.value = setTimeout(() => {
        contactStore.setSearchTerm(value);
      }, 300); // Reduced debounce time for better responsiveness
    };

    // Cleanup on unmount
    onBeforeUnmount(() => {
      if (searchTimeout.value) {
        clearTimeout(searchTimeout.value);
      }
    });

    return {
      sortOrder,
      searchValue,
      handleSortClick,
      debouncedSearchHandler,
      faSearch,
      faUserPlus,
      faSortAlphaUp,
      faSortAlphaDown
    };
  }
};
</script>

<style scoped>
.search-bar {
  contain: content; /* Improve rendering performance */
  will-change: transform; /* Optimize animations */
}

/* Add any existing styles here */
</style>
