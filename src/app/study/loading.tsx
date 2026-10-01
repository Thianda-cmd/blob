import { GooSpinner } from "@/components/blob/GooSpinner";

export default function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <GooSpinner size={56} />
    </div>
  );
}
