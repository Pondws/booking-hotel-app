"use client";

import { Badge } from "@booking/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@booking/ui/components/card";
import { useMe } from "../hooks";

export function AccountDetails() {
  const { data: user } = useMe();
  if (!user) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Your profile details.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[6rem_1fr] gap-y-3 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{user.name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{user.email}</dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd>
            <Badge variant="secondary">{user.role}</Badge>
          </dd>
        </dl>
      </CardContent>
    </Card>
  );
}
