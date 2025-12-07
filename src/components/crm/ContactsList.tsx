import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Mail, Phone, Edit, Trash2 } from "lucide-react";
import { ContactDialog } from "./ContactDialog";

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: "lead" | "prospect" | "customer" | "churned";
  lastContact: string;
}

const mockContacts: Contact[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah@acme.com",
    phone: "+1 555-0123",
    company: "Acme Corp",
    status: "customer",
    lastContact: "2 days ago",
  },
  {
    id: "2",
    name: "Michael Chen",
    email: "m.chen@techstart.io",
    phone: "+1 555-0456",
    company: "TechStart",
    status: "prospect",
    lastContact: "1 week ago",
  },
  {
    id: "3",
    name: "Emily Davis",
    email: "emily@globalinc.com",
    phone: "+1 555-0789",
    company: "Global Inc",
    status: "lead",
    lastContact: "3 days ago",
  },
  {
    id: "4",
    name: "James Wilson",
    email: "jwilson@startup.co",
    phone: "+1 555-0321",
    company: "Startup Co",
    status: "customer",
    lastContact: "Today",
  },
  {
    id: "5",
    name: "Lisa Anderson",
    email: "lisa@enterprise.com",
    phone: "+1 555-0654",
    company: "Enterprise Ltd",
    status: "churned",
    lastContact: "1 month ago",
  },
];

const statusColors: Record<Contact["status"], string> = {
  lead: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  prospect: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  customer: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  churned: "bg-destructive/10 text-destructive border-destructive/20",
};

export function ContactsList() {
  const [search, setSearch] = useState("");
  const [contacts] = useState<Contact[]>(mockContacts);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(search.toLowerCase()) ||
      contact.email.toLowerCase().includes(search.toLowerCase()) ||
      contact.company.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingContact(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Contact
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Contact</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Contact</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.map((contact) => (
              <TableRow key={contact.id} className="cursor-pointer">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {contact.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">{contact.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{contact.company}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColors[contact.status]}>
                    {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{contact.lastContact}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border">
                      <DropdownMenuItem className="gap-2 cursor-pointer">
                        <Mail className="h-4 w-4" />
                        Send Email
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 cursor-pointer">
                        <Phone className="h-4 w-4" />
                        Call
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 cursor-pointer"
                        onClick={() => handleEdit(contact)}
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editingContact}
      />
    </div>
  );
}
