# 開発環境を起動（Hot Reload 対応の next dev）
dev:
	docker compose --profile dev up dev

# 本番と同等のビルドをローカルで検証（next build 相当）
build:
	docker compose --profile build run --rm build

# 本番環境を起動（next start 相当、デタッチモード）
prod:
	docker compose --profile prod up -d runner

# 本番環境用の Docker イメージをビルド（成果物を元に）
prod-build:
	docker compose --profile prod build runner

prod-stop:
	docker compose --profile prod stop runner

prod-exec:
	docker compose --profile prod exec runner sh
