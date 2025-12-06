import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface ComboboxProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

export const Combobox: React.FC<ComboboxProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on query or current value
  const filteredOptions = query === '' 
    ? options 
    : options.filter((opt) => opt.toLowerCase().includes(query.toLowerCase()));

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync internal query with external value when not editing
  useEffect(() => {
    if (!isOpen) {
      setQuery(value);
    }
  }, [value, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setQuery(newVal);
    onChange(newVal); // Allow custom values immediately
    if (!isOpen) setIsOpen(true);
  };

  const handleSelect = (option: string) => {
    onChange(option);
    setQuery(option);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? query : value} 
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-3 pr-10 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none placeholder:text-gray-400"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => {
            if (isOpen) {
              setIsOpen(false);
            } else {
              setIsOpen(true);
              inputRef.current?.focus();
            }
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 p-1 hover:text-gray-600"
        >
          <ChevronDown size={20} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto no-scrollbar">
          {filteredOptions.length === 0 && query !== '' ? (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 italic">
              "{query}" will be added as new
            </div>
          ) : (
            <ul className="py-1">
              {filteredOptions.map((option) => (
                <li
                  key={option}
                  onClick={() => handleSelect(option)}
                  className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    value === option 
                      ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium' 
                      : 'text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <span>{option}</span>
                  {value === option && <Check size={16} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};