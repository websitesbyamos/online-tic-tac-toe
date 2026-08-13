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


// ==========================================
// PLAYER ID
// ==========================================

function getPlayerId() {

    let id =
        localStorage.getItem(
            "tic_player_id"
        );

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

const playerId = getPlayerId();


// ==========================================
// ELEMENTS
// ==========================================

const playerNameInput =
    document.getElementById(
        "playerName"
    );

const roomCodeInput =
    document.getElementById(
        "roomCode"
    );

const statusText =
    document.getElementById(
        "status"
    );

const playersText =
    document.getElementById(
        "players"
    );

const playerXName =
    document.getElementById(
        "playerXName"
    );

const playerOName =
    document.getElementById(
        "playerOName"
    );

const scoreX =
    document.getElementById(
        "scoreX"
    );

const scoreO =
    document.getElementById(
        "scoreO"
    );

const cells =
    document.querySelectorAll(
        ".cell"
    );


// ==========================================
// STATUS
// ==========================================

function setStatus(message) {

    statusText.textContent =
        message;
}


// ==========================================
// GENERATE ROOM CODE
// ==========================================

function generateRoomCode() {

    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    let code = "";

    for (
        let i = 0;
        i < 6;
        i++
    ) {

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
// GET PLAYER NAME
// ==========================================

function getPlayerName() {

    const name =
        playerNameInput
            .value
            .trim();

    if (!name) {

        setStatus(
            "Please enter your name first."
        );

        return null;
    }

    return name.substring(
        0,
        20
    );
}


// ==========================================
// CREATE ROOM
// ==========================================

async function createRoom() {

    const name =
        getPlayerName();

    if (!name) return;

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

                room_code:
                    roomCode,

                board:
                    emptyBoard,

                current_turn:
                    "X",

                winner:
                    "",

                session_winner:
                    "",

                player_x:
                    playerId,

                player_o:
                    null,

                player_x_name:
                    name,

                player_o_name:
                    "Waiting...",

                score_x:
                    0,

                score_o:
                    0,

                starting_player:
                    "X"

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


    currentRoom =
        roomCode;

    myPlayer =
        "X";

    gameData =
        data;


    roomCodeInput.value =
        roomCode;


    playerNameInput.disabled =
        true;


    setStatus(
        "Room created! Share the code with Player 2."
    );


    updatePlayers();

    updateScore();

    subscribeToGame();

    renderBoard();
}


// ==========================================
// JOIN ROOM
// ==========================================

async function joinRoom() {

    const name =
        getPlayerName();

    if (!name) return;


    const roomCode =
        roomCodeInput
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
            .eq(
                "room_code",
                roomCode
            )
            .single();


    if (error || !data) {

        console.error(error);

        setStatus(
            "Room not found."
        );

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

                player_o:
                    playerId,

                player_o_name:
                    name

            })
            .eq(
                "room_code",
                roomCode
            )
            .select()
            .single();


    if (updateError) {

        console.error(
            updateError
        );

        setStatus(
            "Could not join room."
        );

        return;
    }


    currentRoom =
        roomCode;

    myPlayer =
        "O";

    gameData =
        updatedGame;


    playerNameInput.disabled =
        true;


    setStatus(
        "You joined the room!"
    );


    updatePlayers();

    updateScore();

    subscribeToGame();

    renderBoard();
}


// ==========================================
// REALTIME
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
                "game-" +
                currentRoom
            )
            .on(

                "postgres_changes",

                {

                    event:
                        "UPDATE",

                    schema:
                        "public",

                    table:
                        "games",

                    filter:
                        "room_code=eq." +
                        currentRoom

                },

                payload => {

                    gameData =
                        payload.new;

                    renderBoard();

                    updatePlayers();

                    updateScore();

                    updateStatus();

                }

            )
            .subscribe();
}


// ==========================================
// BOARD
// ==========================================

function renderBoard() {

    if (!gameData)
        return;


    let board;


    try {

        board =
            typeof gameData.board ===
            "string"

                ? JSON.parse(
                    gameData.board
                )

                : gameData.board;

    }

    catch (error) {

        console.error(
            "Board error:",
            error
        );

        return;
    }


    cells.forEach(
        (
            cell,
            index
        ) => {

            cell.textContent =
                board[index] ||
                "";

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


    if (!gameData.player_o) {

        setStatus(
            "Waiting for Player 2..."
        );

        return;
    }


    // SESSION ALREADY WON

    if (
        gameData.session_winner
    ) {

        return;
    }


    // ROUND ALREADY FINISHED

    if (
        gameData.winner
    ) {

        return;
    }


    // WRONG TURN

    if (
        gameData.current_turn !==
        myPlayer
    ) {

        setStatus(
            "Wait for your turn."
        );

        return;
    }


    let board =
        typeof gameData.board ===
        "string"

            ? JSON.parse(
                gameData.board
            )

            : gameData.board;


    if (board[index]) {

        return;
    }


    board[index] =
        myPlayer;


    const result =
        checkWinner(
            board
        );


    let winner =
        "";


    if (result) {

        winner =
            result;

    }

    else if (
        board.every(
            cell =>
                cell !== ""
        )
    ) {

        winner =
            "draw";
    }


    const nextTurn =
        myPlayer === "X"
            ? "O"
            : "X";


    let newScoreX =
        Number(
            gameData.score_x || 0
        );


    let newScoreO =
        Number(
            gameData.score_o || 0
        );


    // ======================================
    // ADD ROUND POINT
    // ======================================

    if (winner === "X") {

        newScoreX++;

    }


    if (winner === "O") {

        newScoreO++;

    }


    // ======================================
    // CHECK SESSION WINNER
    // ======================================

    let sessionWinner =
        gameData.session_winner ||
        "";


    if (
        newScoreX >= 5
    ) {

        sessionWinner =
            "X";

    }


    if (
        newScoreO >= 5
    ) {

        sessionWinner =
            "O";

    }


    // ======================================
    // UPDATE GAME
    // ======================================

    const { data, error } =
        await supabaseClient
            .from("games")
            .update({

                board:
                    JSON.stringify(
                        board
                    ),

                current_turn:
                    winner
                        ? gameData.current_turn
                        : nextTurn,

                winner:
                    winner,

                score_x:
                    newScoreX,

                score_o:
                    newScoreO,

                session_winner:
                    sessionWinner

            })
            .eq(
                "room_code",
                currentRoom
            )
            .select()
            .single();


    if (error) {

        console.error(
            error
        );

        setStatus(
            "Move failed."
        );

        return;
    }


    gameData =
        data;


    renderBoard();

    updateScore();

    updateStatus();
}


// ==========================================
// WINNER
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
        const combo
        of combinations
    ) {

        const [
            a,
            b,
            c
        ] = combo;


        if (

            board[a] &&

            board[a] ===
            board[b] &&

            board[a] ===
            board[c]

        ) {

            return board[a];

        }

    }


    return "";
}


// ==========================================
// UPDATE SCORE
// ==========================================

function updateScore() {

    if (!gameData)
        return;


    scoreX.textContent =
        gameData.score_x || 0;


    scoreO.textContent =
        gameData.score_o || 0;
}


// ==========================================
// UPDATE PLAYER NAMES
// ==========================================

function updatePlayers() {

    if (!gameData)
        return;


    playerXName.textContent =
        gameData.player_x_name ||
        "Player X";


    playerOName.textContent =
        gameData.player_o_name ||
        "Player O";


    playersText.textContent =

        gameData.player_o

            ? "Players connected"

            : "Waiting for Player 2...";
}


// ==========================================
// GAME STATUS
// ==========================================

function updateStatus() {

    if (!gameData)
        return;


    // ======================================
    // SESSION WINNER
    // ======================================

    if (
        gameData.session_winner ===
        "X"
    ) {

        if (
            myPlayer === "X"
        ) {

            setStatus(
                "🏆 YOU WON THE SESSION! 🎉"
            );

        }

        else {

            setStatus(
                "🏆 Player X won the session!"
            );

        }

        return;
    }


    if (
        gameData.session_winner ===
        "O"
    ) {

        if (
            myPlayer === "O"
        ) {

            setStatus(
                "🏆 YOU WON THE SESSION! 🎉"
            );

        }

        else {

            setStatus(
                "🏆 Player O won the session!"
            );

        }

        return;
    }


    // ======================================
    // ROUND WINNER
    // ======================================

    if (
        gameData.winner ===
        "X"
    ) {

        if (
            myPlayer === "X"
        ) {

            setStatus(
                "🎉 You won the round!"
            );

        }

        else {

            setStatus(
                "😅 You lost the round."
            );

        }

        return;
    }


    if (
        gameData.winner ===
        "O"
    ) {

        if (
            myPlayer === "O"
        ) {

            setStatus(
                "🎉 You won the round!"
            );

        }

        else {

            setStatus(
                "😅 You lost the round."
            );

        }

        return;
    }


    // ======================================
    // DRAW
    // ======================================

    if (
        gameData.winner ===
        "draw"
    ) {

        setStatus(
            "🤝 Round draw!"
        );

        return;
    }


    // ======================================
    // WAITING
    // ======================================

    if (
        !gameData.player_o
    ) {

        setStatus(
            "Waiting for Player 2..."
        );

        return;
    }


    // ======================================
    // TURN
    // ======================================

    if (
        gameData.current_turn ===
        myPlayer
    ) {

        setStatus(
            "Your turn!"
        );

    }

    else {

        setStatus(
            "Opponent's turn..."
        );

    }
}


// ==========================================
// NEXT ROUND / NEW SESSION
// ==========================================

async function resetGame() {

    if (!currentRoom) {

        setStatus(
            "Create or join a room first."
        );

        return;
    }


    if (!gameData.player_o) {

        setStatus(
            "Waiting for Player 2..."
        );

        return;
    }


    const emptyBoard =
        JSON.stringify([
            "", "", "",
            "", "", "",
            "", "", ""
        ]);


    // ======================================
    // IF SESSION IS FINISHED
    // START COMPLETELY NEW SESSION
    // ======================================

    if (
        gameData.session_winner
    ) {

        const { data, error } =
            await supabaseClient
                .from("games")
                .update({

                    board:
                        emptyBoard,

                    current_turn:
                        "X",

                    starting_player:
                        "X",

                    winner:
                        "",

                    session_winner:
                        "",

                    score_x:
                        0,

                    score_o:
                        0

                })
                .eq(
                    "room_code",
                    currentRoom
                )
                .select()
                .single();


        if (error) {

            console.error(
                error
            );

            setStatus(
                "Could not start new session."
            );

            return;
        }


        gameData =
            data;


        renderBoard();

        updateScore();

        updateStatus();

        return;
    }


    // ======================================
    // NORMAL NEXT ROUND
    // ROTATE STARTING PLAYER
    // ======================================

    const currentStartingPlayer =
        gameData.starting_player === "O"
            ? "O"
            : "X";


    const nextStartingPlayer =
        currentStartingPlayer === "X"
            ? "O"
            : "X";


    const { data, error } =
        await supabaseClient
            .from("games")
            .update({

                board:
                    emptyBoard,

                current_turn:
                    nextStartingPlayer,

                starting_player:
                    nextStartingPlayer,

                winner:
                    ""

            })
            .eq(
                "room_code",
                currentRoom
            )
            .select()
            .single();


    if (error) {

        console.error(
            error
        );

        setStatus(
            "Could not start next round."
        );

        return;
    }


    gameData =
        data;


    renderBoard();

    updateScore();

    updateStatus();
}


// ==========================================
// BOARD CLICK EVENTS
// ==========================================

cells.forEach(
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

const createRoomBtn =
    document.getElementById(
        "createRoom"
    );

const joinRoomBtn =
    document.getElementById(
        "joinRoom"
    );

const resetGameBtn =
    document.getElementById(
        "resetGame"
    );


createRoomBtn.addEventListener(
    "click",
    createRoom
);


joinRoomBtn.addEventListener(
    "click",
    joinRoom
);


resetGameBtn.addEventListener(
    "click",
    resetGame
);
