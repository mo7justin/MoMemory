"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/components/shared/LanguageContext";
import { t } from "@/lib/locales";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ApiDocsPage() {
  const { locale } = useLanguage();
  const [baseUrl, setBaseUrl] = React.useState<string>('');
  const [userId, setUserId] = React.useState<string>('your_email@example.com');
  const [hasUser, setHasUser] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
      
      // Try to get user ID from localStorage
      try {
        const storedUserInfo = localStorage.getItem('userInfo');
        if (storedUserInfo) {
          const info = JSON.parse(storedUserInfo);
          // Prioritize email, then userId/openid
          const id = info.email || info.userId || info.unionid || info.openid;
          if (id) {
            setUserId(id);
            setHasUser(true);
          }
        } else {
            // Fallback to userEmail key if exists
            const email = localStorage.getItem('userEmail');
            if (email) {
                setUserId(email);
                setHasUser(true);
            }
        }
      } catch (e) {
        console.error("Failed to load user info for docs", e);
      }
    }
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('success', locale), {
      description: "Copied to clipboard"
    });
  };

  const CodeBlock = ({ code, language = "bash" }: { code: string, language?: string }) => (
    <div className="relative mt-4 rounded-md bg-zinc-950 p-4">
      <div className="absolute right-4 top-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-zinc-400 hover:text-white"
          onClick={() => copyToClipboard(code)}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <pre className="overflow-x-auto font-mono text-sm text-zinc-50">
        <code>{code}</code>
      </pre>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">{t('apiQuickstart', locale)}</h1>
        <p className="text-muted-foreground">
          Momemory provides a RESTful API that allows you to integrate memory capabilities into your own applications and agents.
        </p>
      </div>

      <Tabs defaultValue="authentication" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="authentication">Authentication</TabsTrigger>
          <TabsTrigger value="memories">Memories</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="apps">Apps</TabsTrigger>
        </TabsList>

        {/* Authentication */}
        <TabsContent value="authentication" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
              <CardDescription>
                Momemory uses API keys or Bearer tokens for authentication. Currently, for MCP usage, we recommend using the user_id directly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Most endpoints require a <code>user_id</code> parameter.
                {hasUser ? (
                    <span className="ml-1 text-green-600 dark:text-green-400 font-medium">
                        (Your detected User ID: {userId})
                    </span>
                ) : (
                    <span className="ml-1 text-muted-foreground">
                        (Please login to see your actual User ID)
                    </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                Base URL: <code className="bg-muted px-1 py-0.5 rounded">{baseUrl}/api/v1</code>
              </p>
              
              <div className="pt-4 border-t">
                <h3 className="text-lg font-medium mb-2">Using API Keys</h3>
                <p className="mb-2 text-sm text-muted-foreground">You can create an API Key in the "API Keys" page and use it in the Authorization header.</p>
                <CodeBlock code={`curl -H "Authorization: Bearer sk-momemory-..." "${baseUrl}/api/v1/memories/?user_id=${userId}"`} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Memories */}
        <TabsContent value="memories" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Add Memory</CardTitle>
              <CardDescription>
                Add a new memory to the system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded bg-green-500/10 text-green-500 text-xs font-bold">POST</span>
                    <code className="text-sm">/memories/</code>
                </div>
                <CodeBlock code={`curl -X POST "${baseUrl}/api/v1/memories/" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "text": "I love hiking in the mountains.",
    "user_id": "${userId}",
    "app": "my_custom_app"
  }'`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Get Memories</CardTitle>
              <CardDescription>
                Retrieve all memories for a user.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-500 text-xs font-bold">POST</span>
                  <code className="text-sm">/memories/filter</code>
                </div>
                
                <CodeBlock code={`curl -X POST "${baseUrl}/api/v1/memories/filter" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "user_id": "${userId}",
    "page": 1,
    "size": 10
  }'`} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Search */}
        <TabsContent value="search" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Search Memories</CardTitle>
              <CardDescription>
                Semantically search for relevant memories.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                   <span className="px-2 py-1 rounded bg-green-500/10 text-green-500 text-xs font-bold">POST</span>
                  <code className="text-sm">/memories/search</code>
                </div>
                
                <CodeBlock code={`curl -X POST "${baseUrl}/api/v1/memories/search" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "query": "What do I like to do outdoors?",
    "user_id": "${userId}",
    "page_size": 5
  }'`} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Apps */}
        <TabsContent value="apps" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>List Apps</CardTitle>
              <CardDescription>
                List all apps associated with your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-500 text-xs font-bold">GET</span>
                  <code className="text-sm">/apps/</code>
                </div>
                
                <CodeBlock code={`curl -X GET "${baseUrl}/api/v1/apps/?user_id=${userId}" \\
  -H "Accept: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY"`} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-4">Python Example</h2>
        <p className="text-muted-foreground mb-4">
            Here is a simple Python script using `requests` to interact with the Memory API.
        </p>
        <CodeBlock language="python" code={`import requests

API_URL = "${baseUrl}/api/v1"
USER_ID = "${userId}"
API_KEY = "sk-momemory-..."

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def add_memory(text):
    response = requests.post(
        f"{API_URL}/memories/",
        headers=headers,
        json={
            "text": text,
            "user_id": USER_ID,
            "app": "python_script"
        }
    )
    return response.json()

def search_memory(query):
    response = requests.post(
        f"{API_URL}/memories/search",
        headers=headers,
        json={
            "query": query,
            "user_id": USER_ID,
            "page_size": 3
        }
    )
    return response.json()

# Add a memory
print(add_memory("I have a meeting with the team at 2 PM."))

# Search for it
print(search_memory("When is my meeting?"))
`} />
      </div>
    </div>
  );
}
