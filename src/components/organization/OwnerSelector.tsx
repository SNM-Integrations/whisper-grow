import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, User } from "lucide-react";
import { useOrganization, ResourceVisibility } from "@/hooks/useOrganization";
import { Label } from "@/components/ui/label";

interface OwnerSelectorProps {
  value: { visibility: ResourceVisibility; organizationId: string | null };
  onChange: (value: { visibility: ResourceVisibility; organizationId: string | null }) => void;
  disabled?: boolean;
  label?: string;
}

export function OwnerSelector({ value, onChange, disabled, label = "Owner" }: OwnerSelectorProps) {
  const { organizations } = useOrganization();

  // Create a composite key: "personal" or "org-{id}"
  const currentValue = value.visibility === "personal" ? "personal" : `org-${value.organizationId}`;

  const handleChange = (selected: string) => {
    if (selected === "personal") {
      onChange({ visibility: "personal", organizationId: null });
    } else {
      const orgId = selected.replace("org-", "");
      onChange({ visibility: "organization", organizationId: orgId });
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={currentValue} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select owner" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="personal">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>Personal (Only Me)</span>
            </div>
          </SelectItem>
          {organizations.map((org) => (
            <SelectItem key={org.id} value={`org-${org.id}`}>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>{org.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
