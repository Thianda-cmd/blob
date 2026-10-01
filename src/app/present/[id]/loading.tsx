import { GooSpinner } from "@/components/blob/GooSpinner";

export default function Loading() {
  return (
    <div data-theme="dark" className="fixed inset-0 grid place-items-center bg-[#0b0b0a]">
      <GooSpinner size={56} label="Loading presentation" />
    </div>
  );
}
