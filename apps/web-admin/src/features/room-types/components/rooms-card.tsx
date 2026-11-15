"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { createRoomSchema, type AdminRoom, type AdminRoomType, type CreateRoomInput } from "@booking/shared";
import { Button } from "@booking/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui/components/card";
import { Input } from "@booking/ui/components/input";
import { Label } from "@booking/ui/components/label";
import { HotelStatusBadge } from "@/features/hotels/components/hotel-list";
import { formErrorMessage } from "@/lib/form-errors";
import { useAddRoom, useUpdateRoom } from "../hooks";

/** Physical rooms of a room type: add, rename inline, deactivate / reactivate. */
export function RoomsCard({ roomType }: { roomType: AdminRoomType }) {
  const active = roomType.rooms.filter((r) => r.isActive).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rooms</CardTitle>
        <p className="text-sm text-muted-foreground">
          {roomType.rooms.length === 0
            ? "Guests can only book this room type once it has an active room."
            : `${active} of ${roomType.rooms.length} active`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <AddRoomForm roomType={roomType} />
        {roomType.rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rooms yet</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {roomType.rooms.map((room) => (
              <RoomRow key={room.id} roomType={roomType} room={room} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AddRoomForm({ roomType }: { roomType: AdminRoomType }) {
  const add = useAddRoom(roomType.hotel.id, roomType.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateRoomInput>({ resolver: zodResolver(createRoomSchema), defaultValues: { number: "" } });
  const error = errors.number?.message ?? (add.isError ? formErrorMessage(add.error) : undefined);

  return (
    <form
      noValidate
      className="space-y-2"
      onSubmit={handleSubmit(({ number }) =>
        add.mutate(number, { onSuccess: () => reset({ number: "" }) }),
      )}
    >
      <Label htmlFor="new-room-number">Add a room</Label>
      <div className="flex gap-2">
        <Input
          id="new-room-number"
          placeholder="Room number, e.g. 101"
          className="max-w-60"
          aria-invalid={!!error}
          {...register("number", { onChange: () => add.reset() })}
        />
        <Button type="submit" variant="outline" disabled={add.isPending}>
          <Plus className="size-4" aria-hidden />
          {add.isPending ? "Adding…" : "Add room"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

function RoomRow({ roomType, room }: { roomType: AdminRoomType; room: AdminRoom }) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateRoom(roomType.hotel.id, roomType.id);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateRoomInput>({ resolver: zodResolver(createRoomSchema), values: { number: room.number } });
  const inputId = `room-${room.id}-number`;
  const error = errors.number?.message ?? (update.isError ? formErrorMessage(update.error) : undefined);

  const stopEditing = () => {
    setEditing(false);
    update.reset();
    reset({ number: room.number });
  };

  return (
    <li className="space-y-2 px-3 py-2">
      {editing ? (
        <form
          noValidate
          className="flex flex-wrap items-center gap-2"
          onSubmit={handleSubmit(({ number }) => {
            if (number === room.number) {
              stopEditing();
              return;
            }
            update.mutate({ roomId: room.id, input: { number } }, { onSuccess: () => setEditing(false) });
          })}
        >
          <Label htmlFor={inputId} className="sr-only">
            Room number
          </Label>
          <Input
            id={inputId}
            autoFocus
            className="max-w-40"
            aria-invalid={!!error}
            {...register("number", { onChange: () => update.reset() })}
          />
          <Button type="submit" size="sm" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={update.isPending} onClick={stopEditing}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="min-w-16 font-medium tabular-nums">{room.number}</span>
          <HotelStatusBadge isActive={room.isActive} />
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Rename room ${room.number}`}
              onClick={() => {
                update.reset();
                setEditing(true);
              }}
            >
              Rename
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={update.isPending}
              aria-label={`${room.isActive ? "Deactivate" : "Reactivate"} room ${room.number}`}
              onClick={() => update.mutate({ roomId: room.id, input: { isActive: !room.isActive } })}
            >
              {room.isActive ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}
