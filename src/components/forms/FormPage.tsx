import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type FormPageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function FormPageHeader({ title, description, actions, className }: FormPageHeaderProps) {
  return (
    <div className={"flex items-start justify-between " + (className ?? "") }>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

type FormPageSectionProps = {
  children: React.ReactNode;
  className?: string;
};

export function FormPageSection({ children, className }: FormPageSectionProps) {
  return (
    <Card className={className}>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
}

type FormPageProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function FormPage({ title, description, actions, children }: FormPageProps) {
  return (
    <div className="space-y-6">
      <FormPageHeader title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}

export default {};