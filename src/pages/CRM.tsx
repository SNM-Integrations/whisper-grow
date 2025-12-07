import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactsList } from "@/components/crm/ContactsList";
import { DealsPipeline } from "@/components/crm/DealsPipeline";
import { CompaniesList } from "@/components/crm/CompaniesList";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Building2, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CRM = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("contacts");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4 px-6 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">CRM</h1>
            <p className="text-sm text-muted-foreground">
              Manage your contacts, deals, and companies
            </p>
          </div>
        </div>
      </header>

      <main className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 bg-muted/50">
            <TabsTrigger value="contacts" className="gap-2">
              <Users className="h-4 w-4" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="deals" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Deals
            </TabsTrigger>
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="h-4 w-4" />
              Companies
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="mt-0">
            <ContactsList />
          </TabsContent>

          <TabsContent value="deals" className="mt-0">
            <DealsPipeline />
          </TabsContent>

          <TabsContent value="companies" className="mt-0">
            <CompaniesList />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CRM;
