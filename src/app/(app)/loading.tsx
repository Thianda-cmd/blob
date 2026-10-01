import { GooSpinner } from "@/components/blob/GooSpinner";

export default function Loading() {
  return (
    <div className="grid flex-1 place-items-center">
      <GooSpinner size={56} />
    </div>
  );
}
