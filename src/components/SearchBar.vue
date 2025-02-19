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
        placeholder="Search contacts..."
        :value="search"
        @input="handleSearchChange"
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
import { computed } from 'vue';
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
  emits: ['update:value'],
  setup(props, { emit }) {
    const contactStore = useContactStore();
    const sortOrder = computed(() => contactStore.sortOrder);
    const search = computed(() => props.value);

    const handleSortClick = () => {
      const newSortOrder = sortOrder.value === 'asc' ? 'desc' : 'asc';
      contactStore.setSortOrder(newSortOrder);
    };

    const handleSearchChange = (event) => {
      emit('update:value', event.target.value);
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
