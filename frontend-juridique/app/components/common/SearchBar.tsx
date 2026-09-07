// app/components/common/SearchBar.tsx

"use client";

interface SearchBarProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
}

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full p-3 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-slate-50/50"
      />
    </div>
  );
}