import { Link, createFileRoute } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { COPY } from "@/config/copy";

export const Route = createFileRoute("/not-found")({
  component: NotFound,
});

export function NotFound() {
  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-12">
      <EmptyState
        icon={Compass}
        title={COPY.notFound.title}
        description={COPY.notFound.body}
        className="w-full max-w-md"
        action={
          <Button asChild>
            <Link to="/">{COPY.notFound.cta}</Link>
          </Button>
        }
      />
    </div>
  );
}
