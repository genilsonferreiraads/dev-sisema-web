import React, { useState } from 'react';
import SearchAutocomplete from './SearchAutocomplete';

const SearchBar = ({ onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  const handleSuggestionSelect = (suggestion) => {
    setSearchTerm(suggestion);
  };

  return (
    <div className="autocomplete-wrapper">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          placeholder="Buscar vídeos..."
          className="w-full px-4 py-2 bg-gray-800 text-white rounded-md"
        />
        <SearchAutocomplete
          searchTerm={searchTerm}
          onSelect={handleSuggestionSelect}
          onSearch={onSearch}
        />
      </form>
    </div>
  );
};

export default SearchBar; 