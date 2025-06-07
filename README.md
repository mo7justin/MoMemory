
# OpenMemory

OpenMemory 是您的个人记忆层，用于大语言模型 - 私有、便携且开源。您的记忆存储在本地，为您提供对数据的完全控制。构建具有个性化记忆的人工智能应用程序，同时保持数据安全。

![](https://private-user-images.githubusercontent.com/94069182/443177726-3c701757-ad82-4afa-bfbe-e049c2b4320b.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NDkyNzM4NDEsIm5iZiI6MTc0OTI3MzU0MSwicGF0aCI6Ii85NDA2OTE4Mi80NDMxNzc3MjYtM2M3MDE3NTctYWQ4Mi00YWZhLWJmYmUtZTA0OWMyYjQzMjBiLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTA2MDclMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUwNjA3VDA1MTkwMVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTEyZmRhMjAzZTNlZWE1OTA1ZDA1OGU3YWJlMDBhYzAxZjNiZjc5M2E3NTU3N2E3M2Y0NWQ0NDYzOTUwZTM4NDgmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.J62CKtp2WGIoGXPxa7HIG2lPA2-n8xLUsNrwshpUKqE)

在 [原项目](https://github.com/mem0ai/mem0/tree/main/openmemory) 的基础上，我们做了以下修改：去掉 make 统一使用 `docker-compose.yml` 管理配置，方便部署到云服务器。

支持的模型：
* OpenAI、Azure OpenAI 以及其他 OpenAI 兼容的代理
* Anthropic
* Ollama
* Together
* Groq
* Litellm
* Mistral AI
* Google AI、Gemini
* DeepSeek
* xAI
* LM Studio
* LangChain


### 前提条件

在开始之前，请确保你的系统已安装以下软件：

*   **Docker**: [安装指南](https://docs.docker.com/get-docker/)
*   **Docker Compose**: [安装指南](https://docs.docker.com/compose/install/)

### 1. 克隆仓库

首先，将项目代码克隆到你的本地机器：

```bash
git clone https://github.com/YourUsername/OpenMemory.git
cd OpenMemory
```

### 2. 配置环境变量

你需要为后端服务配置 API 密钥和其他必要的环境变量。这些变量直接在 `docker-compose.yml` 文件中定义。

打开 `docker-compose.yml` 文件，找到 `openmemory-mcp` 服务下的 `environment` 部分，并根据你的需求进行修改：

```yaml
services:
  openmemory-mcp:
    # ...
    environment:
      - USER=USER  # 设置默认用户 ID
      - API_KEY=sk-xx # <-- **请将此处替换为你的真实 API 密钥**
      - OPENAI_BASE_URL=https://xxx # 替换 OpenAI 兼容的代理，删除则使用默认 OpenAI
    # ...
  openmemory-ui:
    # ...
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8765 # 前端访问后端的地址,如果部署到服务器上,请修改为服务器的地址或域名
      - NEXT_PUBLIC_USER_ID=USER # 前端使用的用户 ID
    # ...
```

**重要提示：**
*   **USER/NEXT_PUBLIC_USER_ID**: 确保前后端的 `USER` 和 `NEXT_PUBLIC_USER_ID` 保持一致。

### 3. 构建并运行服务

配置完成后，使用 Docker Compose 构建并启动所有服务：

```bash
docker compose up --build -d
```

*   `--build`: 首次运行或代码更改后，此选项强制重新构建镜像。
*   `-d`: 在后台运行所有服务，释放你的终端。

首次构建可能需要一些时间，因为 Docker Compose 会下载基础镜像、安装依赖并构建应用程序镜像。

### 4. 访问应用程序

一旦所有服务成功启动，你可以通过以下地址访问应用程序：

*   **OpenMemory UI (前端)**: [http://localhost:3000](http://localhost:3000)
*   **OpenMemory API (后端)**: [http://localhost:8765/docs](http://localhost:8765/docs)
*   **OpenMemory MCP**: [http://localhost:8765/mcp/openmemory/sse/{USER}](http://localhost:8765/mcp/openmemory/sse/{USER}) 替换USER为设置的ID
*   **Qdrant 向量数据库**: [http://localhost:6333/dashboard](http://localhost:6333/dashboard)

### 5. 清理

要停止并移除所有 Docker 容器、网络和卷：

```bash
docker compose down -v
```

` -v` 选项将同时移除 Qdrant 持久化数据卷，慎用。如果只想停止服务而不删除数据，请使用 `docker compose down`。

---

## Project Structure

- `api/` - Backend APIs + MCP server
- `ui/` - Frontend React application

## Contributing

We are a team of developers passionate about the future of AI and open-source software. With years of experience in both fields, we believe in the power of community-driven development and are excited to build tools that make AI more accessible and personalized.

We welcome all forms of contributions:
- Bug reports and feature requests
- Documentation improvements
- Code contributions
- Testing and feedback
- Community support

How to contribute:

1. Fork the repository
2. Create your feature branch (`git checkout -b openmemory/feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin openmemory/feature/amazing-feature`)
5. Open a Pull Request

Join us in building the future of AI memory management! Your contributions help make OpenMemory better for everyone.
