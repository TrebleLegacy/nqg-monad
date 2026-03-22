// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title NQGVoting
 * @notice Neural Quorum Governance — reputation-based voting with quorum delegation on Monad
 * @dev Ported from Stellar's NQG system. Voting power = f(tier, history). 
 *      Quorum delegation: delegate to N people, auto-vote follows majority.
 *      Votes relayed by server hot wallet for voter privacy.
 */
contract NQGVoting {
    // ============================================================
    //                        TYPES
    // ============================================================

    enum Tier { Newcomer, Contributor, Expert, Admin }

    struct Voter {
        Tier tier;
        uint256 votesParticipated;
        address[] quorumDelegates;
        bool registered;
    }

    struct Proposal {
        string question;
        string[] options;
        uint256 endTime;
        address creator;
        bool exists;
        bool quorumResolved;
    }

    struct VoteRecord {
        bool hasVoted;
        uint256 optionIndex;
        uint256 weight;
    }

    // ============================================================
    //                        STATE
    // ============================================================

    address public owner;
    address public relayer;

    uint256 public proposalCount;

    // Tier scores: Newcomer=1, Contributor=3, Expert=5, Admin=8
    uint256[4] public tierScores = [1, 3, 5, 8];
    uint256 public constant MAX_HISTORY_BONUS = 5;
    uint256 public constant MIN_QUORUM_SIZE = 3;
    uint256 public constant MAX_QUORUM_SIZE = 5;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(uint256 => uint256)) public voteTallies; // proposalId => optionIndex => weightedVotes
    mapping(uint256 => mapping(address => VoteRecord)) public voteRecords; // proposalId => voter => record
    mapping(address => Voter) public voters;
    mapping(uint256 => uint256) public totalVoteWeight; // proposalId => total weight cast

    // ============================================================
    //                        EVENTS
    // ============================================================

    event ProposalCreated(uint256 indexed proposalId, string question, uint256 endTime);
    event VoterRegistered(address indexed voter);
    event VoteCast(uint256 indexed proposalId, uint256 optionIndex, uint256 weight);
    event QuorumDelegatesSet(address indexed voter, address[] delegates);
    event QuorumVoteResolved(uint256 indexed proposalId, address indexed voter, uint256 optionIndex, uint256 weight);
    event TierUpdated(address indexed voter, Tier newTier);

    // ============================================================
    //                        MODIFIERS
    // ============================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyRelayer() {
        require(msg.sender == relayer || msg.sender == owner, "Not relayer");
        _;
    }

    // ============================================================
    //                        CONSTRUCTOR
    // ============================================================

    constructor(address _relayer) {
        owner = msg.sender;
        relayer = _relayer;
    }

    // ============================================================
    //                     VOTER MANAGEMENT
    // ============================================================

    function registerVoter(address _voter) external onlyRelayer {
        require(!voters[_voter].registered, "Already registered");
        voters[_voter].registered = true;
        voters[_voter].tier = Tier.Newcomer;
        emit VoterRegistered(_voter);
    }

    function setVoterTier(address _voter, Tier _tier) external onlyOwner {
        require(voters[_voter].registered, "Not registered");
        voters[_voter].tier = _tier;
        emit TierUpdated(_voter, _tier);
    }

    function setQuorumDelegates(address _voter, address[] memory _delegates) external onlyRelayer {
        require(voters[_voter].registered, "Not registered");
        require(_delegates.length >= MIN_QUORUM_SIZE && _delegates.length <= MAX_QUORUM_SIZE, "Invalid quorum size");
        
        // Verify all delegates are registered
        for (uint i = 0; i < _delegates.length; i++) {
            require(voters[_delegates[i]].registered, "Delegate not registered");
            require(_delegates[i] != _voter, "Cannot self-delegate");
        }
        
        voters[_voter].quorumDelegates = _delegates;
        emit QuorumDelegatesSet(_voter, _delegates);
    }

    // ============================================================
    //                     NEURAL SCORE
    // ============================================================

    function getVotePower(address _voter) public view returns (uint256) {
        if (!voters[_voter].registered) return 0;
        
        Voter storage v = voters[_voter];
        
        // Neuron 1: Tier score
        uint256 tierScore = tierScores[uint256(v.tier)];
        
        // Neuron 2: Voting history (capped)
        uint256 historyBonus = v.votesParticipated > MAX_HISTORY_BONUS 
            ? MAX_HISTORY_BONUS 
            : v.votesParticipated;
        
        // Neural aggregation (Layer 1: sum)
        return tierScore + historyBonus;
    }

    // ============================================================
    //                      PROPOSALS
    // ============================================================

    function createProposal(
        string memory _question,
        string[] memory _options,
        uint256 _duration
    ) external onlyRelayer returns (uint256) {
        require(_options.length >= 2 && _options.length <= 10, "2-10 options");
        require(_duration > 0, "Duration must be > 0");

        uint256 proposalId = proposalCount++;
        
        Proposal storage p = proposals[proposalId];
        p.question = _question;
        p.options = _options;
        p.endTime = block.timestamp + _duration;
        p.creator = msg.sender;
        p.exists = true;

        emit ProposalCreated(proposalId, _question, p.endTime);
        return proposalId;
    }

    // ============================================================
    //                       VOTING
    // ============================================================

    function vote(uint256 _proposalId, address _voter, uint256 _optionIndex) external onlyRelayer {
        Proposal storage p = proposals[_proposalId];
        require(p.exists, "Proposal not found");
        require(block.timestamp < p.endTime, "Voting ended");
        require(!voteRecords[_proposalId][_voter].hasVoted, "Already voted");
        require(voters[_voter].registered, "Not registered");
        require(_optionIndex < p.options.length, "Invalid option");

        uint256 weight = getVotePower(_voter);
        
        voteRecords[_proposalId][_voter] = VoteRecord({
            hasVoted: true,
            optionIndex: _optionIndex,
            weight: weight
        });
        
        voteTallies[_proposalId][_optionIndex] += weight;
        totalVoteWeight[_proposalId] += weight;
        
        // Increment voter's participation history
        voters[_voter].votesParticipated++;

        emit VoteCast(_proposalId, _optionIndex, weight);
    }

    // ============================================================
    //                   QUORUM DELEGATION
    // ============================================================

    function resolveQuorumVote(uint256 _proposalId, address _voter) external onlyRelayer {
        Proposal storage p = proposals[_proposalId];
        require(p.exists, "Proposal not found");
        require(!voteRecords[_proposalId][_voter].hasVoted, "Already voted");
        require(voters[_voter].registered, "Not registered");
        
        address[] storage delegates = voters[_voter].quorumDelegates;
        require(delegates.length >= MIN_QUORUM_SIZE, "No quorum set");

        // Count delegate votes
        uint256 numOptions = p.options.length;
        uint256[] memory optionVotes = new uint256[](numOptions);
        uint256 participatingDelegates = 0;

        for (uint i = 0; i < delegates.length; i++) {
            VoteRecord storage dv = voteRecords[_proposalId][delegates[i]];
            if (dv.hasVoted) {
                optionVotes[dv.optionIndex]++;
                participatingDelegates++;
            }
        }

        // Need majority of delegates to have voted (>50%)
        require(participatingDelegates * 2 > delegates.length, "Quorum not met");

        // Find option with most delegate votes
        uint256 winningOption = 0;
        uint256 maxVotes = 0;
        for (uint i = 0; i < numOptions; i++) {
            if (optionVotes[i] > maxVotes) {
                maxVotes = optionVotes[i];
                winningOption = i;
            }
        }

        // Auto-vote for the delegator
        uint256 weight = getVotePower(_voter);
        
        voteRecords[_proposalId][_voter] = VoteRecord({
            hasVoted: true,
            optionIndex: winningOption,
            weight: weight
        });
        
        voteTallies[_proposalId][winningOption] += weight;
        totalVoteWeight[_proposalId] += weight;
        voters[_voter].votesParticipated++;

        emit QuorumVoteResolved(_proposalId, _voter, winningOption, weight);
    }

    // ============================================================
    //                       VIEWS
    // ============================================================

    function getResults(uint256 _proposalId) external view returns (uint256[] memory) {
        Proposal storage p = proposals[_proposalId];
        require(p.exists, "Proposal not found");
        
        uint256[] memory results = new uint256[](p.options.length);
        for (uint i = 0; i < p.options.length; i++) {
            results[i] = voteTallies[_proposalId][i];
        }
        return results;
    }

    function getProposalOptions(uint256 _proposalId) external view returns (string[] memory) {
        require(proposals[_proposalId].exists, "Not found");
        return proposals[_proposalId].options;
    }

    function getProposalInfo(uint256 _proposalId) external view returns (
        string memory question,
        uint256 endTime,
        uint256 optionCount,
        uint256 totalWeight,
        bool active
    ) {
        Proposal storage p = proposals[_proposalId];
        require(p.exists, "Not found");
        return (
            p.question,
            p.endTime,
            p.options.length,
            totalVoteWeight[_proposalId],
            block.timestamp < p.endTime
        );
    }

    function getVoterInfo(address _voter) external view returns (
        bool registered,
        uint256 tier,
        uint256 votesParticipated,
        uint256 votePower,
        uint256 quorumSize
    ) {
        Voter storage v = voters[_voter];
        return (
            v.registered,
            uint256(v.tier),
            v.votesParticipated,
            getVotePower(_voter),
            v.quorumDelegates.length
        );
    }

    function getQuorumDelegates(address _voter) external view returns (address[] memory) {
        return voters[_voter].quorumDelegates;
    }
}
