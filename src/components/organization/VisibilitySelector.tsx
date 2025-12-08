import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, User } from "lucide-react";
import { useOrganization, ResourceVisibility } from "@/hooks/useOrganization";

interface VisibilitySelectorProps {
  value: ResourceVisibility;
  onChange: (value: ResourceVisibility, orgId: string | null) => void;
  disabled?: boolean;
}

export function VisibilitySelector({ value, onChange, disabled }: VisibilitySelectorProps) {
  const { currentOrg, context } = useOrganization();

  // If user is in personal mode or has no orgs, don't show selector
  if (context.mode === "personal" || !currentOrg) {
    return null;
  }

  const handleChange = (newValue: ResourceVisibility) => {
    const orgId = newValue === "organization" ? currentOrg.id : null;
    onChange(newValue, orgId);
  };

  return (
    <Select value={value} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="personal">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Only Me</span>
          </div>
        </SelectItem>
        <SelectItem value="organization">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span>{currentOrg.name}</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
