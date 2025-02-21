<template>
  <div class="search-bar">
    <!-- Sort Toggle Button -->
    <button 
      @click="handleSortClick" 
      class="sort-button"
      :aria-label="`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`"
    >
      <FontAwesomeIcon :icon="sortOrder === 'asc' ? faSortAlphaDown : faSortAlphaUp" />
    </button>

    <!-- Search Input -->
    <div class="search-input-container">
      <FontAwesomeIcon :icon="faSearch" class="search-icon" />
      <input
        type="text"
        placeholder="Search by name or phone..."
        :value="search"
        @keyup="handleSearchChange"
        aria-label="Search contacts"
      />
    </div>

    <!-- Add Contact Button -->
    <button 
      class="add-button" 
      @click="$emit('add')"
      aria-label="Add new contact"
    >
      <FontAwesomeIcon :icon="faUserPlus" />
    </button>
  </div>
</template>

<script>
import { computed, ref } from 'vue';
import { useContactStore } from '../stores/contacts';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faSearch, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { faSortAlphaUp, faSortAlphaDown } from '@fortawesome/free-solid-svg-icons';

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
    const sortOrder = computed(() => contactStore.sortOrder);
    const search = computed(() => props.value);
    const searchTimeout = ref(null);
    
    const handleSortClick = () => {
      const newSortOrder = sortOrder.value === 'asc' ? 'desc' : 'asc';
      contactStore.setSortOrder(newSortOrder);
    };

    const handleSearchChange = (event) => {
      const value = event.target.value;
      emit('update:value', value);
      
      // Clear existing timeout
      if (searchTimeout.value) {
        clearTimeout(searchTimeout.value);
      }
      
      // Debounce search
      searchTimeout.value = setTimeout(() => {
        contactStore.setSearchTerm(value);
      }, 300);
    };

    return {
      sortOrder,
      search,
      handleSortClick,
      handleSearchChange,
      faSearch,
      faUserPlus,
      faSortAlphaUp,
      faSortAlphaDown
    };
  }
};
</script>
