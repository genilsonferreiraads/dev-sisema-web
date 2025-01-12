import React, { useState, useEffect, useRef } from 'react';

const SearchAutocomplete = ({ searchTerm, onSelect, onSearch }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    // Fetch suggestions only if searchTerm has at least 2 characters
    if (searchTerm.length >= 2) {
      fetchSuggestions(searchTerm);
    } else {
      setSuggestions([]);
    }
  }, [searchTerm]);

  useEffect(() => {
    // Click outside handler
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsVisible(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (query) => {
    try {
      const response = await fetch(
        `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}`,
        { mode: 'cors' }
      );
      const data = await response.json();
      setSuggestions(data[1]);
      setIsVisible(true);
    } catch (error) {
      console.error('Erro ao buscar sugestões:', error);
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    onSelect(suggestion);
    setIsVisible(false);
    onSearch(suggestion); // Isso vai disparar a busca e abrir o modal
  };

  if (!isVisible || suggestions.length === 0) return null;

  return (
    <div 
      ref={wrapperRef}
      className="absolute z-50 w-full bg-gray-800 rounded-md shadow-lg mt-1 custom-scrollbar"
      style={{ maxHeight: '300px', overflowY: 'auto' }}
    >
      {suggestions.map((suggestion, index) => (
        <div
          key={index}
          className="px-4 py-2 hover:bg-gray-700 cursor-pointer text-white"
          onClick={() => handleSuggestionClick(suggestion)}
        >
          {suggestion}
        </div>
      ))}
    </div>
  );
};

export default SearchAutocomplete; 