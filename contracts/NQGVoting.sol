// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title NQGVoting
 * @notice Neural Quorum Governance — admin-managed reputation-based voting on Monad
 * @dev Admin approves participants with assigned scores. Admin controls voting start.
 *      Voting power = tierScore + min(votesParticipated, 5).
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
        bool approved; // Must be approved by admin to vote
    }

    struct Proposal {
        string question;
        string[] options;
        uint256 endTime;
        uint256 startTime; // Admin decides when voting starts
        address creator;
        bool exists;
        bool started; // Voting only proceeds after admin starts it
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
    mapping(uint256 => mapping(uint256 => uint256)) public voteTallies;
    mapping(uint256 => mapping(address => VoteRecord)) public voteRecords;
    mapping(address => Voter) public voters;
    mapping(uint256 => uint256) public totalVoteWeight;

    address[] public approvedVoterList; // Track all approved voters

    // ============================================================
    //                        EVENTS
    // ============================================================

    event ProposalCreated(uint256 indexed proposalId, string question);
    event ProposalStarted(uint256 indexed proposalId, uint256 endTime);
    event VoterApproved(address indexed voter, Tier tier);
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
    //              ADMIN: APPROVE & SCORE PARTICIPANTS
    // ============================================================

    /// @notice Admin approves a voter and assigns their reputation tier
    function approveVoter(address _voter, Tier _tier) external onlyOwner {
        require(!voters[_voter].approved, "Already approved");
        voters[_voter].registered = true;
        voters[_voter].approved = true;
        voters[_voter].tier = _tier;
        approvedVoterList.push(_voter);
        emit VoterApproved(_voter, _tier);
    }

    /// @notice Admin batch-approves multiple voters with tiers
    function batchApproveVoters(
        address[] memory _voters,
        Tier[] memory _tiers
    ) external onlyOwner {
        require(_voters.length == _tiers.length, "Length mismatch");
        for (uint i = 0; i < _voters.length; i++) {
            if (!voters[_voters[i]].approved) {
                voters[_voters[i]].registered = true;
                voters[_voters[i]].approved = true;
                voters[_voters[i]].tier = _tiers[i];
                approvedVoterList.push(_voters[i]);
                emit VoterApproved(_voters[i], _tiers[i]);
            }
        }
    }

    /// @notice Admin updates a voter's tier
    function setVoterTier(address _voter, Tier _tier) external onlyOwner {
        require(voters[_voter].approved, "Not approved");
        voters[_voter].tier = _tier;
        emit TierUpdated(_voter, _tier);
    }

    /// @notice Self-register (pending approval — registered but not approved)
    function registerVoter(address _voter) external onlyRelayer {
        if (!voters[_voter].registered) {
            voters[_voter].registered = true;
            voters[_voter].tier = Tier.Newcomer;
        }
    }

    function setQuorumDelegates(address _voter, address[] memory _delegates) external onlyRelayer {
        require(voters[_voter].approved, "Not approved");
        require(_delegates.length >= MIN_QUORUM_SIZE && _delegates.length <= MAX_QUORUM_SIZE, "Invalid quorum size");
        
        for (uint i = 0; i < _delegates.length; i++) {
            require(voters[_delegates[i]].approved, "Delegate not approved");
            require(_delegates[i] != _voter, "Cannot self-delegate");
        }
        
        voters[_voter].quorumDelegates = _delegates;
        emit QuorumDelegatesSet(_voter, _delegates);
    }

    // ============================================================
    //                     NEURAL SCORE
    // ============================================================

    function getVotePower(address _voter) public view returns (uint256) {
        if (!voters[_voter].approved) return 0;
        
        Voter storage v = voters[_voter];
        uint256 tierScore = tierScores[uint256(v.tier)];
        uint256 historyBonus = v.votesParticipated > MAX_HISTORY_BONUS 
            ? MAX_HISTORY_BONUS 
            : v.votesParticipated;
        
        return tierScore + historyBonus;
    }

    // ============================================================
    //                      PROPOSALS
    // ============================================================

    /// @notice Create a proposal (does NOT start voting yet)
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
        p.endTime = 0; // Not set until admin starts
        p.startTime = 0;
        p.creator = msg.sender;
        p.exists = true;
        p.started = false;

        // Store duration in endTime temporarily (will be recalculated on start)
        p.endTime = _duration;

        emit ProposalCreated(proposalId, _question);
        return proposalId;
    }

    /// @notice Admin starts voting on a proposal
    function startVoting(uint256 _proposalId) external onlyOwner {
        Proposal storage p = proposals[_proposalId];
        require(p.exists, "Proposal not found");
        require(!p.started, "Already started");
        
        uint256 duration = p.endTime; // Duration was stored temporarily
        p.startTime = block.timestamp;
        p.endTime = block.timestamp + duration;
        p.started = true;

        emit ProposalStarted(_proposalId, p.endTime);
    }

    // ============================================================
    //                       VOTING
    // ============================================================

    function vote(uint256 _proposalId, address _voter, uint256 _optionIndex) external onlyRelayer {
        Proposal storage p = proposals[_proposalId];
        require(p.exists, "Proposal not found");
        require(p.started, "Voting not started");
        require(block.timestamp >= p.startTime, "Voting not started yet");
        require(block.timestamp < p.endTime, "Voting ended");
        require(!voteRecords[_proposalId][_voter].hasVoted, "Already voted");
        require(voters[_voter].approved, "Not approved to vote");
        require(_optionIndex < p.options.length, "Invalid option");

        uint256 weight = getVotePower(_voter);
        
        voteRecords[_proposalId][_voter] = VoteRecord({
            hasVoted: true,
            optionIndex: _optionIndex,
            weight: weight
        });
        
        voteTallies[_proposalId][_optionIndex] += weight;
        totalVoteWeight[_proposalId] += weight;
        voters[_voter].votesParticipated++;

        emit VoteCast(_proposalId, _optionIndex, weight);
    }

    // ============================================================
    //                   QUORUM DELEGATION
    // ============================================================

    function resolveQuorumVote(uint256 _proposalId, address _voter) external onlyRelayer {
        Proposal storage p = proposals[_proposalId];
        require(p.exists, "Proposal not found");
        require(p.started, "Voting not started");
        require(!voteRecords[_proposalId][_voter].hasVoted, "Already voted");
        require(voters[_voter].approved, "Not approved");
        
        address[] storage delegates = voters[_voter].quorumDelegates;
        require(delegates.length >= MIN_QUORUM_SIZE, "No quorum set");

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

        require(participatingDelegates * 2 > delegates.length, "Quorum not met");

        uint256 winningOption = 0;
        uint256 maxVotes = 0;
        for (uint i = 0; i < numOptions; i++) {
            if (optionVotes[i] > maxVotes) {
                maxVotes = optionVotes[i];
                winningOption = i;
            }
        }

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
        bool active,
        bool started
    ) {
        Proposal storage p = proposals[_proposalId];
        require(p.exists, "Not found");
        bool isActive = p.started && block.timestamp >= p.startTime && block.timestamp < p.endTime;
        return (
            p.question,
            p.endTime,
            p.options.length,
            totalVoteWeight[_proposalId],
            isActive,
            p.started
        );
    }

    function getVoterInfo(address _voter) external view returns (
        bool registered,
        bool approved,
        uint256 tier,
        uint256 votesParticipated,
        uint256 votePower,
        uint256 quorumSize
    ) {
        Voter storage v = voters[_voter];
        return (
            v.registered,
            v.approved,
            uint256(v.tier),
            v.votesParticipated,
            getVotePower(_voter),
            v.quorumDelegates.length
        );
    }

    function getQuorumDelegates(address _voter) external view returns (address[] memory) {
        return voters[_voter].quorumDelegates;
    }

    function getApprovedVoterCount() external view returns (uint256) {
        return approvedVoterList.length;
    }

    function getApprovedVoters() external view returns (address[] memory) {
        return approvedVoterList;
    }
}
