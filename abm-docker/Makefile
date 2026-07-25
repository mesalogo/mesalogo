.PHONY: build up up-core up-control disable-control down restart logs status clean help up-milvus up-graphiti up-lightrag up-onlyoffice up-galapagos up-vscode up-paddleocr up-mariadb up-all

help:
	@echo "ABM-LLM-V2 Docker 管理命令"
	@echo ""
	@echo "使用方法: make [命令]"
	@echo ""
	@echo "命令:"
	@echo "  build          构建镜像"
	@echo "  up             启动核心服务 (backend, frontend)"
	@echo "  up-core        一键启动核心 + 数据库 + Redis (本地常用)"
	@echo "  up-control     为后端启用服务控制（挂载 Docker Socket）"
	@echo "  disable-control 关闭服务控制并移除 Docker Socket 挂载"
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
	@echo "前端: http://localhost:16000"
	@echo "后端: http://localhost:16001"

up-core:
	docker compose \
		-f docker-compose.yml \
		-f docker-compose.mariadb.yml \
		-f docker-compose.redis.yml \
		--profile core --profile mariadb --profile redis up -d
	@echo ""
	@echo "核心 + 数据库 + Redis 已启动！"
	@echo "前端: http://localhost:16000"
	@echo "后端: http://localhost:16001"
	@echo "MariaDB: localhost:16011    Redis: localhost:16010"

up-control:
	@test -S /var/run/docker.sock || { echo "错误: /var/run/docker.sock 不存在或不是 Unix Socket"; exit 1; }
	@echo "警告: Docker Socket 可提供等同宿主 root 的控制能力，仅在受信任环境启用。"
	docker compose \
		-f docker-compose.yml \
		-f docker-compose.service-control.yml \
		--profile core up -d --no-deps --force-recreate backend
	@echo "服务控制已启用，backend 已重新创建。"

disable-control:
	docker compose \
		-f docker-compose.yml \
		--profile core up -d --no-deps --force-recreate backend
	@echo "服务控制已关闭，Docker Socket 挂载已从 backend 移除。"

up-milvus:
	docker compose --profile milvus up -d
	@echo "Milvus 服务已启动"

up-graphiti:
	docker compose --profile graphiti up -d
	@echo "Graphiti 服务已启动"

up-lightrag:
	docker compose --profile lightrag up -d
	@echo "LightRAG 服务已启动: http://localhost:16050"

up-onlyoffice:
	docker compose --profile onlyoffice up -d
	@echo "OnlyOffice 服务已启动"

up-galapagos:
	docker compose --profile galapagos up -d
	@echo "Galapagos 服务已启动"

up-vscode:
	docker compose --profile vscode-server up -d
	@echo "VSCode Server 已启动: https://localhost:16080"

up-paddleocr:
	docker compose --profile paddleocr-vl up -d
	@echo "PaddleOCR-VL 已启动: http://localhost:16070"

up-mariadb:
	docker compose --profile mariadb up -d
	@echo "MariaDB 已启动: localhost:16011"

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
