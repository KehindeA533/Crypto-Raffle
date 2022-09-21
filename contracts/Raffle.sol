// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;
//Imports
import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import '@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol';
import '@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol';

//Custom Errors
error enterRaffle_NotEnoughETHEntered();
error fulfillRandomWords_TransferFailed();
error enterRaffle_RaffleNotOpen();
error performUpkeep__UpkeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 raffleState
);

/**@title A Raffle Contract
 * @author Kehinde Adegbamigbe
 * @notice This contract is for creating an untamperable decentralized smart contract
 * @dev This implements the Chainlink VRF Version 2 and chainlinkKeepers
 */
contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /* Type Declarations */
    enum RaffleState {
        OPEN,
        CALCULATING
    } //uint256 0 = OPEN, 1 = CALCULATING

    /* State variables */
    uint256 private immutable i_entranceFee;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;
    address payable[] private s_players; //***Whenever we update a dynamic object, like an array or a mapping, we always want to omit an event, espically for frontend

    //Lottery Varaiables
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    /* Event */
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner, uint256 indexed requestId);

    /**
     * @notice constructor inherits a VRFConsumerBase and initiates the values for gasLane(keyHash), entranceFee, lastTimeStamp, interval, raffleState, callbackGasLimit, subscriptionId
     * @param vrfCoordinatorV2 is the address of the contract that does the random number verification.
     * @param entranceFee The amount of ETH need to enter the raffle
     * @param subscriptionId the ID that this contract uses for funding requests.
     * @param gasLane ID of public key against which randomness is generated
     * @param callbackGasLimit The limit for how much gas to use for the callback request to your contract's fulfillRandomWords() function.
     * @param interval The amount of time needed to request a random winner,
     */
    constructor(
        address vrfCoordinatorV2, //Contract
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    /// @notice Allows players to enter raffle by paying entrance fee, can only be access when raffle state is open, pushes entered players into s_players array emits event
    function enterRaffle() public payable {
        //Set entrnce Fee
        if (msg.value < i_entranceFee) {
            revert enterRaffle_NotEnoughETHEntered();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert enterRaffle_RaffleNotOpen();
        }
        s_players.push(payable(msg.sender));
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev This is the function that the Chainlink Keeper nodes call
     * they look for `upkeepNeeded` to return True.
     * the following should be true for this to return true:
     * 1. The time interval has passed between raffle runs.
     * 2. The lottery is open.
     * 3. The contract has ETH.
     * 4. Implicity, your subscription is funded with LINK.
     */
    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (
            /*view*/
            bool upkeepNeeded,
            bytes memory /* performData */
        )
    {
        bool isOpen = (RaffleState.OPEN == s_raffleState); // is lottery open
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval); //has enough time passed
        bool hasPlayers = (s_players.length > 0); //has enough players
        bool hasBalance = address(this).balance > 0; //has any money in lottery
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
    }

    /// @notice checkupKeep must be called before performUpkeep can be called, raffle state is intializes to calculating
    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        //Request the random number
        //Once we get it, do something
        //2 transaction process
        (bool upkeepNeeded, ) = checkUpkeep(''); 
        if (!upkeepNeeded) {
            revert performUpkeep__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane, //gasLane
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedRaffleWinner(requestId);
    }

    /**
     * fulfillRandomness is called by VRFCoordinator when it receives a valid VRF proof.
     * This function is overrided to act upon the random number generated by Chainlink VRF.
     * @param requestId  this ID is unique for the request we sent to the VRF Coordinator
     * @param randomWords this is a random unit256 generated and returned to us by the VRF Coordinator
     */
    function fulfillRandomWords(
        uint256 requestId, //What is requestID for??
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}('');
        if (!success) {
            revert fulfillRandomWords_TransferFailed();
        }
        emit WinnerPicked(s_recentWinner, requestId);
    }

    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}

    /** View / Pure Function */
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getGasLane() public view returns (bytes32) {
        return i_gasLane;
    }
}
