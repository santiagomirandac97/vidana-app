
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function QuickEmployeeActivation() {
  const [employeeName, setEmployeeName] = useState("");

  const handleSave = () => {
    // TODO: Implement the logic to save the employee name
    console.log("Employee Name:", employeeName);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Employee Activation</CardTitle>
        <CardDescription>
          Manually enter the employee name to activate their account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Name of the employee"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
              />
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">Cancel</Button>
        <Button onClick={handleSave}>Save</Button>
      </CardFooter>
    </Card>
  );
}
