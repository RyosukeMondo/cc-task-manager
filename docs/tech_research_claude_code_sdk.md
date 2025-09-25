Claude Code SDKとバックグラウンドタスク管理システムの連携に関する詳細技術調査報告書序文：理論から実践へ前回の報告書では、Next.jsフロントエンドと連携するバックグラウンドタスク管理システムの全体アーキテクチャとして、NestJS、BullMQ、PM2などを組み合わせたOSSスタックを提案しました。本報告書では、そのアーキテクチャの心臓部であるNode.jsワーカープロセスとclaude code sdkの具体的な連携に焦点を当て、ユーザー要件である「プロセスの呼び出し」「リアルタイムな状態監視」「障害からの自動回復」を実現するための実践的な実装戦略を詳述します。第1部：Claude Code SDKの実行戦略とインターフェース設計claude codeは、Node.jsワーカーから直接実行されるのではなく、子プロセスとして起動される外部プログラムです。この連携をいかに安全かつ効率的に行うかが、システム全体の安定性を左右します。1.1. 実行インターフェースの選定：Python SDKラッパーclaude codeは、CLIツール (@anthropic-ai/claude-code) と、それをプログラムから利用するためのSDK（Python/TypeScript）を提供しています 1。Node.jsワーカーからこの機能を呼び出すにあたり、CLIコマンドを直接実行するのではなく、claude-code-sdk for Pythonを利用する専用のPythonスクリプト（以下、ラッパースクリプト）を作成し、それを子プロセスとして呼び出すアプローチを強く推奨します。選定理由:構造化されたデータ交換: 複雑なプロンプトや設定オプションをコマンドライン引数として渡すのは煩雑でエラーの元です。ラッパースクリプトを介することで、プロンプトはstdinから、設定はファイルや単純な引数で受け取り、stdoutからは構造化されたJSON形式で進捗や結果をストリーミング出力させることが可能になります。高度なSDK機能の活用: Python SDKが提供する詳細な設定 (ClaudeCodeOptions) や型定義、エラーハンドリング機構を最大限に活用できます 2。関心の分離: claude codeとの対話ロジックをPythonラッパースクリプトにカプセル化することで、Node.jsワーカーは子プロセスの管理とジョブキューとの連携という自身の責務に集中できます。1.2. Node.jsワーカーからの安全な呼び出し：child_process.spawn前回の報告書でも触れた通り、外部プロセスの起動にはchild_process.spawnを使用します 4。これは、コマンドインジェクション脆弱性を原理的に回避できる最も安全な方法です 6。TypeScript// In a NestJS BullMQ Worker
import { spawn } from 'child_process';

//... inside the job processing method...
const claudeProcess = spawn(
  'python3',
  [
    '-u', // Unbuffered stdout/stderr is crucial for real-time output [7, 8]
    '/path/to/claude_wrapper.py',
    '--job-id', job.id,
    '--session-name', `session_${job.id}`
  ],
  {
    cwd: '/path/to/target/project', // Set the working directory for Claude Code [2]
    detached: false // Keep it attached to the worker for signal handling
  }
);

// Send the prompt via stdin to handle complex or large inputs
claudeProcess.stdin.write(JSON.stringify({ prompt: job.data.prompt }));
claudeProcess.stdin.end();
1.3. Pythonラッパースクリプトの基本設計このスクリプトは、Node.jsワーカーとclaude code sdkの間の翻訳者として機能します。主な機能:引数とstdinの解析: コマンドライン引数からジョブIDやセッション名を受け取り、stdinからプロンプト本文を読み込みます。シグナルハンドリング: Node.jsワーカーからの中断要求（SIGTERM）を捕捉し、claude codeのセッションを安全に終了させるためのクリーンアップ処理を実装します 9。SDKの初期化と実行: 受け取った情報でClaudeCodeOptionsを構成し、query()関数を呼び出します 2。構造化された出力: query()から非同期で返されるメッセージを解析し、進捗、思考プロセス、最終結果などを標準的なJSON形式でstdoutに出力します。Python# claude_wrapper.py
import sys
import json
import asyncio
import signal
from claude_code_sdk import query, ClaudeCodeOptions, AssistantMessage, TextBlock

# --- 1. Signal Handler for Graceful Shutdown ---
def handle_sigterm(signum, frame):
    print(json.dumps({"type": "status", "message": "SIGTERM received, shutting down."}), flush=True)
    # Add any SDK-specific cleanup logic here if available
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_sigterm)

async def main():
    # --- 2. Parse Arguments and Stdin ---
    # (Code to parse args like --session-name and read prompt from sys.stdin)
    
    options = ClaudeCodeOptions(
        # Configure options based on parsed arguments
        cwd="/path/to/target/project",
        allowed_tools=,
        permission_mode="acceptAll" # Caution: for automated tasks [12]
    )

    try:
        # --- 3. Execute Query and Stream Output ---
        async for message in query(prompt=prompt_text, options=options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        # --- 4. Structured JSON Output ---
                        print(json.dumps({
                            "type": "progress",
                            "content": block.text
                        }), flush=True)
            # (Add handling for other message types like ToolUseBlock)

    except Exception as e:
        print(json.dumps({"type": "error", "message": str(e)}), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
第2部：リアルタイム状態監視の実装claude codeプロセスの状態を正確に把握することは、システムの信頼性とユーザー体験の向上に不可欠です。単一の監視方法では不十分なため、複数のアプローチを組み合わせた多層的な監視戦略を提案します。2.1. プロセス生存監視（PIDベース）claude codeプロセスが予期せずクラッシュした場合、即座に検知する必要があります。PIDの記録: spawnはChildProcessオブジェクトを返し、これにはpidプロパティが含まれています 7。ワーカーはジョブ開始時にこのPIDをBullMQのジョブデータやデータベースに保存します。存在確認: プロセスが長時間active状態にある場合など、ワーカーは保存したPIDを使い、プロセスの生存を確認できます。これには、Node.jsライブラリps-nodeを利用するか 14、Linuxのkill -0 <PID>コマンドを実行する古典的な手法が有効です 16。kill -0はシグナルを送信せずにプロセスの存在のみを確認し、プロセスが存在しない場合にエラーを返すため、軽量なヘルスチェックとして最適です。2.2. アクティビティ監視（ファイルシステムイベントベース）プロセスの生存だけでは、処理が内部で停止（ハングアップ）しているケースを検知できません。ユーザーの要件にある通り、session_name.jsonlファイルの監視は、プロセスが実際に活動しているかを判断する上で極めて有効な手段です。実装にはchokidarライブラリを推奨します。 Node.js標準のfs.watchはOS間の挙動に差異があり不安定な場合がありますが、chokidarはこれらの差異を吸収し、より安定したクロスプラットフォームのファイル監視機能を提供します 17。監視ワークフロー:監視開始: ワーカーはclaude codeプロセスを起動後、対応するsession_name.jsonlファイルをchokidar.watch()で監視します。タイムスタンプ更新: chokidarがchangeイベントを検知するたびに、ワーカーはデータベースに記録された「最終アクティビティ時刻」を更新します。ハングアップ検知: ワーカーは、例えばsetIntervalを使い、定期的に「最終アクティビティ時刻」と現在時刻を比較します。もし設定した閾値（例：5分）を超えても更新がない場合、プロセスはハングアップしたと判断します。awaitWriteFinishオプションの活用: claude codeが大きなデータをファイルに書き込む場合、書き込み途中でchangeイベントが複数回発生する可能性があります。chokidarのawaitWriteFinishオプションを設定することで、ファイルの書き込みが完了し、ファイルサイズが一定時間安定するまでイベントの発火を待機させることができます。これにより、より正確なアクティビティ検知が可能になります 18。2.3. 実行進捗のストリーミング監視最も詳細な状態は、claude codeプロセス自身のstdoutから得られます。Pythonラッパースクリプトが構造化されたJSONを出力することで、ワーカーはこれをリアルタイムで解析し、タスクの具体的な進捗を把握できます。TypeScript// In the NestJS Worker, listening to the spawned process
claudeProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line);
  for (const line of lines) {
    try {
      const output = JSON.parse(line);
      switch (output.type) {
        case 'progress':
          // Update job progress in BullMQ
          job.updateProgress({ message: output.content });
          // Push update to frontend via WebSocket
          this.sendProgressToFrontend(job.id, output.content);
          break;
        case 'result':
          // Handle final result
          break;
        //... other cases
      }
    } catch (error) {
      // Handle non-JSON output or parsing errors
    }
  }
});
第3部：堅牢な連携ワークフローの設計ここまでの要素を組み合わせ、タスクの開始から完了、中断、そして障害発生時の回復に至るまでの完全なワークフローを設計します。3.1. タスク中断（キャンセル）のフローユーザーからのタスク中断要求に、迅速かつ安全に対応する仕組みは不可欠です。中断要求: ユーザーがNext.jsのUIからタスク中断を指示します。APIサーバーはリクエストを受け、データベース内の該当ジョブに「中断要求フラグ」を立てます。シグナル送信: ワーカープロセスは、このフラグを定期的にポーリングするか、Redis Pub/Subなどを通じて通知を受け取ります。中断を検知すると、管理しているclaude code子プロセスのPIDに対し、child.kill('SIGTERM')メソッドを使ってSIGTERMシグナルを送信します 4。SIGTERMはプロセスに正常終了を要求する標準的なシグナルです 22。グレースフルシャットダウン: Pythonラッパースクリプト側では、あらかじめ登録しておいたシグナルハンドラがSIGTERMを捕捉します 10。ハンドラは、進行中の処理を安全に停止し、必要なクリーンアップ（例：一時ファイルの削除）を行った後、プロセスを終了させます。ジョブ状態の更新: Node.jsワーカーは、子プロセスのexitイベントを監視しています。シグナルによってプロセスが終了すると、このイベントが発火します。ワーカーはこれを受け、BullMQのジョブを「失敗」としてマークし、理由として「ユーザーによりキャンセル」を記録します。3.2. 障害発生時の自動回復フローシステムのどこかで障害が発生しても、タスクが失われたり、システム全体が停止したりすることを防ぎます。ケースA：claude codeプロセスがクラッシュ検知: ワーカーは子プロセスのexitイベントで非ゼロの終了コードを検知します。対応: ワーカーはこれをジョブの失敗とみなし、stderrから得られたエラー情報と共にジョブをfailed状態に遷移させます。回復: BullMQに設定されたリトライ戦略（例：指数バックオフ付きで3回まで再試行）に従い、ジョブは自動的に再キューイングされます 23。再試行時に、ワーカーは新しいclaude code子プロセスを起動して処理を再開します。ケースB：ワーカープロセス自体がクラッシュ検知: プロセス管理ツールであるPM2が、ワーカープロセスの予期せぬ終了を即座に検知します 24。対応: PM2は設定に従い、ワーカープロセスを自動的に再起動します。回復: BullMQには、一定時間アクティブなまま進捗がないジョブを「stalled（失速）」と判断し、再度キューに戻す機能があります 25。再起動したワーカー、あるいは他の正常なワーカーがこのstalledジョブを取得し、処理を再開します。これにより、ワーカーのクラッシュによってタスクが失われることはありません。ケースC：claude codeプロセスがハングアップ検知: 前述の「アクティビティ監視」メカニズムにより、session_name.jsonlファイルの更新が一定時間途絶えたことをワーカーが検知します。対応: ワーカーは、応答のない子プロセスをchild.kill('SIGKILL')で強制的に終了させます。その後、ジョブをfailed状態（理由：ハングアップタイムアウト）に設定します。回復: ケースAと同様に、BullMQのリトライ機構が後続の処理を引き継ぎます。結論：多層防御による堅牢な連携の実現claude code sdkと提案のOSSスタックとの連携は、単一の技術に依存するのではなく、複数のメカニズムを組み合わせた多層防御アプローチによって実現されます。プロセスレベル: child_process.spawnによる安全な実行と、SIGTERMによるグレースフルシャットダウン。ファイルシステムレベル: chokidarによるアクティビティ監視とハングアップ検知。ジョブキューレベル: BullMQによる永続化、リトライ、stalledジョブの自動回復。サービスレベル: PM2によるワーカープロセスの永続化と自動再起動。このアーキテクチャは、各コンポーネントがそれぞれの責務に特化し、疎結合に連携することで、特定のコンポーネントで障害が発生してもシステム全体が停止することなく、タスクの実行を継続できる高い耐障害性と観測可能性を確保します。これにより、開発者は信頼性の高いAIタスク管理アプリケーションを効率的に構築することが可能となります。