import React, { useState, useEffect } from 'react';
import SearchBar from '../components/SearchBar';
import CardGrid from '../components/CardGrid';
import Pagination from '../components/Pagination';
import Footer from '../components/Footer';

export default function Home() {
  const [cards, setCards] = useState([]);
  const [query, setQuery] = useState('');
  const [cardType, setCardType] = useState('');
  const [atkType, setAtkType] = useState('');
  const [playOrder, setPlayOrder] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchCards();
  }, [query, cardType, atkType, playOrder, currentPage]);

  const fetchCards = async () => {
    try {
      const params = new URLSearchParams({
        q: query,
        card_type: cardType,
        atk_type: atkType,
        play_order: playOrder,
        page: currentPage,
      });

      const response = await fetch(`/cards?${params}`);
      const data = await response.json();
      setCards(data.items);
      setTotalPages(Math.ceil(data.total_count / 20));
      setTotalCount(data.total_count);
    } catch (error) {
      console.error('Error fetching cards:', error);
    }
  };


   const handleSearch = ({ query: newQuery, cardType: newCardType, atkType: newAtkType, playOrder: newPlayOrder }) => {
        setQuery(newQuery);
        setCardType(newCardType);
        setAtkType(newAtkType);
        setPlayOrder(newPlayOrder);
        setCurrentPage(1);
   };


  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-white">
      <div className="container mx-auto px-4 py-8">
        <SearchBar onSearch={handleSearch} />
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
        <div className="mt-2 text-sm text-gray-400">
          {`Showing ${cards.length} of ${totalCount} matching cards`}
        </div>
        <div className="mt-6">
          {cards.length === 0 ? (
            <p className="text-gray-400">No cards found.</p>
          ) : (
            <CardGrid cards={cards} />
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

