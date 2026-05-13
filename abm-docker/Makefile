.PHONY: build up down restart logs status clean help up-milvus up-graphiti up-lightrag up-onlyoffice up-galapagos up-vscode up-paddleocr up-mariadb up-all

help:
	@echo "ABM-LLM-V2 Docker 管理命令"
	@echo ""
	@echo "使用方法: make [命令]"
	@echo ""
	@echo "命令:"
	@echo "  build          构建镜像"
	@echo "  up             启动核心服务 (backend, frontend)"
	@echo "  up-milvus      启动 Milvus"
	@echo "  up-graphiti    启动 Graphiti/Neo4j (记忆系统)"
	@echo "  up-lightrag    启动 LightRAG (知识库系统)"
	@echo "  up-onlyoffice  启动 OnlyOffice"
	@echo "  up-galapagos   启动 Galapagos"
	@echo "  up-vscode      启动 VSCode Server"
	@echo "  up-paddleocr   启动 PaddleOCR-VL (需要GPU)"
	@echo "  up-mariadb     启动 MariaDB 数据库"
	@echo "  up-all         启动所有服务"
	@echo "  down           停止服务"
	@echo "  restart        重启服务"
	@echo "  logs           查看日志"
	@echo "  status         查看状态"
	@echo "  clean          清理容器和镜像"
	@echo ""
	@echo "也可以通过 .env 中的 COMPOSE_PROFILES 配置启用的服务"

build:
	./build-docker-image.sh all

up:
	docker compose --profile core up -d
	@echo ""
	@echo "核心服务已启动！"
	@echo "前端: http://localhost:3080"
	@echo "后端: http://localhost:8080"

up-milvus:
	docker compose --profile milvus up -d
	@echo "Milvus 服务已启动"

up-graphiti:
	docker compose --profile graphiti up -d
	@echo "Graphiti 服务已启动"

up-lightrag:
	docker compose --profile lightrag up -d
	@echo "LightRAG 服务已启动: http://localhost:9621"

up-onlyoffice:
	docker compose --profile onlyoffice up -d
	@echo "OnlyOffice 服务已启动"

up-galapagos:
	docker compose --profile galapagos up -d
	@echo "Galapagos 服务已启动"

up-vscode:
	docker compose --profile vscode-server up -d
	@echo "VSCode Server 已启动: https://localhost:11443"

up-paddleocr:
	docker compose --profile paddleocr-vl up -d
	@echo "PaddleOCR-VL 已启动: http://localhost:8050"

up-mariadb:
	docker compose --profile mariadb up -d
	@echo "MariaDB 已启动: localhost:3306"

up-all:
	docker compose --profile core --profile milvus --profile graphiti --profile lightrag --profile onlyoffice --profile galapagos --profile vscode-server --profile paddleocr-vl --profile mariadb up -d
	@echo "所有服务已启动"

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

status:
	docker compose ps

clean:
	docker compose down -v --rmi all
	docker system prune -f
