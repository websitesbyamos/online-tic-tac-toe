// ==========================================
// SUPABASE CONNECTION
// ==========================================

const SUPABASE_URL =
    "https://fxzwataeechgjvjgipcj.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_boDHu2zFK4Bc3nOcuzpg3w_sUaEXC79";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


// ==========================================
// GAME VARIABLES
// ==========================================

let currentRoom = null;
let myPlayer = null;
let gameData = null;
let realtimeChannel = null;

const playerId = getPlayerId();


// ==========================================
// PLAYER ID
// ==========================================

function getPlayerId() {

    let id =
        localStorage.getItem("tic_player_id");

    if (!id) {

        id =
            Math.random()
                .toString(36)
                .substring(2, 10);

        localStorage.setItem(
            "tic_player_id",
            id
        );
    }

    return id;
}


// ==========================================
// ROOM CODE
// ==========================================

function generateRoomCode() {

    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    let code = "";

    for (let i = 0; i < 6; i++) {

        code +=
            characters.charAt(
                Math.floor(
                    Math.random() *
                    characters.length
                )
            );
    }

    return code;
}


// ==========================================
// CREATE ROOM
// ==========================================

async function createRoom() {

    const roomCode =
        generateRoomCode();

    const emptyBoard =
        JSON.stringify([
            "", "", "",
            "", "", "",
            "", "", ""
        ]);

    const { data, error } =
        await supabaseClient
            .from("games")
            .insert({
                room_code: roomCode,
                board: emptyBoard,
                current_turn: "X",
                winner: "",
                player_x: playerId,
                player_o: null
            })
            .select()
            .single();

    if (error) {

        console.error(error);

        setStatus(
            "Could not create room."
        );

        return;
    }

    currentRoom = roomCode;
    myPlayer = "X";
    gameData = data;

    document.getElementById(
        "roomCode"
    ).value = roomCode;

    setStatus(
        "Room created! Share the code with Player 2."
    );

    document.getElementById(
        "players"
    ).textContent =
        "You are Player X";

    subscribeToGame();

    renderBoard();
}


// ==========================================
// JOIN ROOM
// ==========================================

async function joinRoom() {

    const roomCode =
        document
            .getElementById("roomCode")
            .value
            .trim()
            .toUpperCase();

    if (!roomCode) {

        setStatus(
            "Enter a room code first."
        );

        return;
    }

    const { data, error } =
        await supabaseClient
            .from("games")
            .select("*")
            .eq("room_code", roomCode)
            .single();

    if (error || !data) {

        setStatus(
            "Room not found."
        );

        console.error(error);

        return;
    }

    if (data.player_o) {

        setStatus(
            "This room is already full."
        );

        return;
    }

    const { data: updatedGame, error: updateError } =
        await supabaseClient
            .from("games")
            .update({
                player_o: playerId
            })
            .eq("room_code", roomCode)
            .select()
            .single();

    if (updateError) {

        console.error(updateError);

        setStatus(
            "Could not join room."
        );

        return;
    }

    currentRoom = roomCode;
    myPlayer = "O";
    gameData = updatedGame;

    setStatus(
        "You joined the room!"
    );

    document.getElementById(
        "players"
    ).textContent =
        "You are Player O";

    subscribeToGame();

    renderBoard();
}


// ==========================================
// REALTIME CONNECTION
// ==========================================

function subscribeToGame() {

    if (realtimeChannel) {

        supabaseClient
            .removeChannel(
                realtimeChannel
            );
    }

    realtimeChannel =
        supabaseClient
            .channel(
                "game-" + currentRoom
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "games",
                    filter:
                        "room_code=eq." +
                        currentRoom
                },
                payload => {

                    gameData =
                        payload.new;

                    renderBoard();
                    updateStatus();
                }
            )
            .subscribe();
}


// ==========================================
// RENDER BOARD
// ==========================================

function renderBoard() {

    if (!gameData) return;

    let board;

    try {

        board =
            typeof gameData.board === "string"
                ? JSON.parse(gameData.board)
                : gameData.board;

    } catch (error) {

        console.error(
            "Board error:",
            error
        );

        return;
    }

    const cells =
        document.querySelectorAll(
            ".cell"
        );

    cells.forEach(
        (cell, index) => {

            cell.textContent =
                board[index] || "";

        }
    );

    updateStatus();
}


// ==========================================
// MAKE MOVE
// ==========================================

async function makeMove(index) {

    if (!gameData) {

        setStatus(
            "Create or join a room first."
        );

        return;
    }

    if (
        gameData.current_turn !==
        myPlayer
    ) {

        setStatus(
            "Wait for your turn."
        );

        return;
    }

    if (gameData.winner) {

        return;
    }

    let board =
        typeof gameData.board === "string"
            ? JSON.parse(gameData.board)
            : gameData.board;

    if (board[index]) {

        return;
    }

    board[index] =
        myPlayer;

    const result =
        checkWinner(board);

    let winner = "";

    if (result) {

        winner = result;

    } else if (
        board.every(
            cell => cell !== ""
        )
    ) {

        winner = "draw";

    }

    const nextTurn =
        myPlayer === "X"
            ? "O"
            : "X";

    const { data, error } =
        await supabaseClient
            .from("games")
            .update({
                board:
                    JSON.stringify(board),

                current_turn:
                    winner
                        ? gameData.current_turn
                        : nextTurn,

                winner: winner
            })
            .eq(
                "room_code",
                currentRoom
            )
            .select()
            .single();

    if (error) {

        console.error(error);

        setStatus(
            "Move failed. Try again."
        );

        return;
    }

    gameData = data;

    renderBoard();
}


// ==========================================
// WINNER CHECK
// ==========================================

function checkWinner(board) {

    const combinations = [

        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],

        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],

        [0, 4, 8],
        [2, 4, 6]

    ];

    for (
        const combo of combinations
    ) {

        const [a, b, c] =
            combo;

        if (
            board[a] &&
            board[a] === board[b] &&
            board[a] === board[c]
        ) {

            return board[a];

        }
    }

    return "";
}


// ==========================================
// STATUS
// ==========================================

function updateStatus() {

    if (!gameData) return;

    if (
        gameData.winner === "X" ||
        gameData.winner === "O"
    ) {

        if (
            gameData.winner ===
            myPlayer
        ) {

            setStatus(
                "🎉 You won!"
            );

        } else {

            setStatus(
                "😅 You lost!"
            );
        }

        return;
    }

    if (
        gameData.winner ===
        "draw"
    ) {

        setStatus(
            "🤝 It's a draw!"
        );

        return;
    }

    if (!gameData.player_o) {

        setStatus(
            "Waiting for Player 2..."
        );

        return;
    }

    if (
        gameData.current_turn ===
        myPlayer
    ) {

        setStatus(
            "Your turn!"
        );

    } else {

        setStatus(
            "Opponent's turn..."
        );
    }
}


function setStatus(message) {

    document.getElementById(
        "status"
    ).textContent =
        message;
}


// ==========================================
// BOARD CLICK EVENTS
// ==========================================

document
    .querySelectorAll(".cell")
    .forEach(
        cell => {

            cell.addEventListener(
                "click",
                () => {

                    const index =
                        Number(
                            cell.dataset.index
                        );

                    makeMove(index);

                }
            );

        }
    );


// ==========================================
// BUTTON EVENTS
// ==========================================

document
    .getElementById("createRoom")
    .addEventListener(
        "click",
        createRoom
    );


document
    .getElementById("joinRoom")
    .addEventListener(
        "click",
        joinRoom
    );


console.log(
    "🎮 Tic-Tac-Toe loaded!"
);// ==========================================
// RESET GAME
// ==========================================

async function resetGame() {

    if (!currentRoom) {
        setStatus("Create or join a room first.");
        return;
    }

    const emptyBoard = JSON.stringify([
        "", "", "",
        "", "", "",
        "", "", ""
    ]);

    const { data, error } =
        await supabaseClient
            .from("games")
            .update({
                board: emptyBoard,
                current_turn: "X",
                winner: ""
            })
            .eq("room_code", currentRoom)
            .select()
            .single();

    if (error) {
        console.error(error);
        setStatus("Could not reset the game.");
        return;
    }

    gameData = data;

    renderBoard();

    setStatus("New game started! Player X goes first.");
}


// ==========================================
// RESET BUTTON
// ==========================================

document
    .getElementById("resetGame")
    .addEventListener(
        "click",
        resetGame
    );