import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import FoodCard from "../components/FoodCard";
import LoadingSpinner from "../components/LoadingSpinner";
import PageContainer from "../components/PageContainer";
import StickyCartBar from "../components/StickyCartBar";
import { useCart } from "../context/CartContext";
import useMenu from "../hooks/useMenu";

const TASTE_OPTIONS = ["All", "Spicy", "Mild", "Sweet", "Savory", "Healthy"];

export default function Menu() {
  const [searchParams] = useSearchParams();
  const canteenId = searchParams.get("canteenId");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [taste, setTaste] = useState("All");
  const [isTasteOpen, setIsTasteOpen] = useState(false);

  const params = useMemo(
    () => ({
      limit: 50,
      ...(search ? { search } : {}),
      ...(category ? { category } : {}),
      ...(taste && taste !== "All" ? { taste } : {}),
      ...(canteenId ? { canteenId } : {}),
    }),
    [search, category, taste, canteenId]
  );
  const { items, loading, error, reload } = useMenu(params);
  const { addItem } = useCart();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (items.length > 0) {
      const currentCats = items.map((item) => item.category).filter(Boolean);
      setCategories((prev) => Array.from(new Set([...prev, ...currentCats])));
    }
  }, [items]);

  const handleResetFilters = () => {
    setSearch("");
    setCategory("");
    setTaste("All");
  };

  const hasActiveFilters = Boolean(search || category || (taste && taste !== "All"));

  return (
    <PageContainer>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Made for your break</p>
          <h1 className="section-title mt-2">Pick your favourites</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">Fresh choices, clear prices, and less time waiting around.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsTasteOpen((prev) => !prev)}
          aria-expanded={isTasteOpen}
          aria-label="Filter by taste"
          className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold transition shadow-sm border ${
            taste !== "All"
              ? "border-teal-700 bg-teal-50 text-teal-800"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <SlidersHorizontal size={15} className="text-teal-700" />
          <span>{taste === "All" ? "Filter by taste" : `Taste: ${taste}`}</span>
          {taste !== "All" && (
            <span className="h-2 w-2 rounded-full bg-teal-600" aria-hidden="true" />
          )}
        </button>
      </header>

      {/* Taste options expansion drawer */}
      {isTasteOpen && (
        <div
          aria-label="Taste filters"
          className="surface mt-4 flex flex-wrap items-center gap-2 p-3 transition"
        >
          <span className="mr-1 text-xs font-bold text-slate-400">Taste:</span>
          {TASTE_OPTIONS.map((opt) => {
            const isActive = taste === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setTaste(opt)}
                className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                  isActive
                    ? "bg-teal-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {opt === "All" ? "All tastes" : opt}
              </button>
            );
          })}
          {taste !== "All" && (
            <button
              type="button"
              onClick={() => setTaste("All")}
              className="ml-auto flex items-center gap-1 text-xs font-bold text-teal-700 hover:underline"
            >
              <RotateCcw size={13} /> Reset taste
            </button>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="surface mt-5 flex items-center gap-3 px-4 py-3.5">
        <Search size={20} className="shrink-0 text-teal-700" aria-hidden="true" />
        <label htmlFor="menu-search" className="sr-only">Search menu</label>
        <input
          id="menu-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search dishes, snacks, drinks..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
          >
            <X size={17} />
          </button>
        )}
      </div>

      {/* Categories Bar */}
      {categories.length > 0 && (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Menu categories">
          <button
            type="button"
            onClick={() => setCategory("")}
            className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-black ${
              !category ? "bg-teal-700 text-white" : "bg-white text-slate-600 shadow-sm"
            }`}
          >
            All items
          </button>
          {categories.map((itemCategory) => (
            <button
              key={itemCategory}
              type="button"
              onClick={() => setCategory(itemCategory)}
              className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-black ${
                category === itemCategory ? "bg-teal-700 text-white" : "bg-white text-slate-600 shadow-sm"
              }`}
            >
              {itemCategory}
            </button>
          ))}
        </div>
      )}

      {/* Active filters badge bar if any filters active */}
      {hasActiveFilters && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold">Active filters:</span>
          {category && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 font-bold text-teal-800 border border-teal-200/60">
              Category: {category}
              <button type="button" onClick={() => setCategory("")} aria-label="Remove category filter" className="hover:text-teal-950"><X size={12} /></button>
            </span>
          )}
          {taste !== "All" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 font-bold text-teal-800 border border-teal-200/60">
              Taste: {taste}
              <button type="button" onClick={() => setTaste("All")} aria-label="Remove taste filter" className="hover:text-teal-950"><X size={12} /></button>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 font-bold text-teal-800 border border-teal-200/60">
              Search: "{search}"
              <button type="button" onClick={() => setSearch("")} aria-label="Remove search query" className="hover:text-teal-950"><X size={12} /></button>
            </span>
          )}
          <button
            type="button"
            onClick={handleResetFilters}
            className="ml-auto text-xs font-black text-teal-700 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="mt-8">
        {loading && <LoadingSpinner label="Finding something delicious..." />}
        {error && <ErrorMessage message={error} onRetry={reload} />}
        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center">
            <EmptyState
              title="Nothing matches those filters"
              description="Try a different search, or clear your category and taste filters to see the full menu."
            />
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 rounded-xl bg-teal-700 px-4 py-2 text-xs font-black text-white hover:bg-teal-800"
              >
                Reset all filters
              </button>
            )}
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <FoodCard key={item._id} item={item} onAdd={addItem} featured={items.indexOf(item) === 0} />
            ))}
          </div>
        )}
      </div>
      <StickyCartBar />
    </PageContainer>
  );
}
