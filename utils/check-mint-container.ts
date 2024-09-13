import { exec } from 'child_process';
import * as util from 'util';

const execPromise = util.promisify(exec);

interface ContainerStatus {
    containerName: string;
    loopNumber: string;
    revealAccepted: string;
    previousLoopNumber: number | null; // To track the last loop number
    loopsPassed: number; // To show how many loops have passed since the last update
}

// Function to execute Docker command and return the logs
async function getDockerLogs(containerName: string): Promise<string> {
    try {
        const { stdout } = await execPromise(`sudo docker logs ${containerName} 2>&1 | tail -100`);
        return stdout;
    } catch (error) {
        return '';
    }
}

// Function to extract the loop number and reveal transaction status
function parseLogs(logs: string): { loopNumber: number | null, revealAccepted: string } {
    const loopMatch = logs.match(/\[INFO\] Starting loop iteration (\d+)/);
    const revealMatch = logs.match(/\[INFO\] Reveal transaction has been accepted:/);

    return {
        loopNumber: loopMatch ? parseInt(loopMatch[1], 10) : null,
        revealAccepted: revealMatch ? 'Yes' : 'No'
    };
}

// Function to generate and display the table
async function generateTable(containers: ContainerStatus[]) {
    console.clear();
    console.log('container\t\tloop_num\tReveal_Accepted?\tLoops_Passed/min');
    console.log('--------------------------------------------------------------------');

    for (const container of containers) {
        // Check if the container is running
        try {
            const { stdout: containerCheck } = await execPromise(`sudo docker ps --format "{{.Names}}" | grep ${container.containerName}`);
            if (containerCheck.trim()) {
                const logs = await getDockerLogs(container.containerName);
                const { loopNumber, revealAccepted } = parseLogs(logs);

                // Calculate loops passed since the last update
                let loopsPassed = 0;
                if (loopNumber !== null && container.previousLoopNumber !== null) {
                    loopsPassed = loopNumber - container.previousLoopNumber;
                }

                // Update the container's status
                container.loopNumber = loopNumber !== null ? loopNumber.toString() : 'N/A';
                container.revealAccepted = revealAccepted;
                container.loopsPassed = loopsPassed;
                container.previousLoopNumber = loopNumber; // Save the current loop number for the next update

                console.log(`${container.containerName}\t${container.loopNumber}\t\t${container.revealAccepted}\t\t\t${loopsPassed}`);
            } else {
                console.log(`${container.containerName}\tNot Running\tN/A\t\tN/A`);
            }
        } catch (error) {
            console.log(`${container.containerName}\tNot Running\tN/A\t\tN/A`);
        }
    }
}

// Function to refresh the table every 60 seconds
async function startMonitoring() {
    // Initialize the containers with null previous loop number and 0 loops passed
    const containers: ContainerStatus[] = Array.from({ length: 10 }, (_, i) => ({
        containerName: `utils-minting-app-${i + 1}-1`,
        loopNumber: 'N/A',
        revealAccepted: 'N/A',
        previousLoopNumber: null,
        loopsPassed: 0
    }));

    await generateTable(containers);
    setInterval(() => generateTable(containers), 60000); // Refresh every 60 seconds
}

startMonitoring();
