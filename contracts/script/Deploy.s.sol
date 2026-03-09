// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/CredentialRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        CredentialRegistry registry = new CredentialRegistry();

        vm.stopBroadcast();

        console.log("CredentialRegistry deployed at:", address(registry));
        console.log("Owner:", registry.owner());
    }
}
