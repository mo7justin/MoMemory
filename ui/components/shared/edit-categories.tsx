"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Pencil } from "lucide-react";
import { useMemoriesApi } from "@/hooks/useMemoriesApi";

interface EditCategoriesProps {
  memoryId: string;
  initialCategories: string[];
  onCategoriesUpdated: (categories: string[]) => void;
}

export function EditCategories({
  memoryId,
  initialCategories,
  onCategoriesUpdated,
}: EditCategoriesProps) {
  const { updateMemoryCategories } = useMemoriesApi();
  const [isEditing, setIsEditing] = useState(false);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [newCategory, setNewCategory] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  const handleAddCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setNewCategory("");
    }
  };

  const handleRemoveCategory = (categoryToRemove: string) => {
    setCategories(categories.filter((cat) => cat !== categoryToRemove));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await updateMemoryCategories(memoryId, categories);
      onCategoriesUpdated(categories);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update categories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setCategories(initialCategories);
    setIsEditing(false);
    setNewCategory("");
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Badge
              key={category}
              variant="outline"
              className="flex items-center gap-1 bg-zinc-800 border-zinc-700"
            >
              <span>{category}</span>
              <button
                onClick={() => handleRemoveCategory(category)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="添加新类别"
            className="text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAddCategory();
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddCategory}
            disabled={!newCategory.trim()}
            className="border-zinc-700"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading ? "保存中..." : "保存"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="border-zinc-700"
          >
            取消
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Badge
            key={category}
            variant="outline"
            className="bg-zinc-800 border-zinc-700"
          >
            {category}
          </Badge>
        ))}
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsEditing(true)}
        className="self-start border-zinc-700 text-zinc-400 hover:text-white"
      >
        <Pencil className="h-3 w-3 mr-1" />
        编辑类别
      </Button>
    </div>
  );
}