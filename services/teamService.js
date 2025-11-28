import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    getDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import transactionService from './transactionService';

class TeamService {
    // --- Teams ---

    async getTeams(userId) {
        try {
            const q = query(
                collection(db, 'teams'),
                where('userId', '==', userId)
            );

            const querySnapshot = await getDocs(q);
            const teams = [];

            querySnapshot.forEach((doc) => {
                teams.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return { success: true, teams };
        } catch (error) {
            console.error('Error fetching teams:', error);
            return { success: false, error: error.message, teams: [] };
        }
    }

    async addTeam(userId, teamData) {
        try {
            const docRef = await addDoc(collection(db, 'teams'), {
                userId,
                ...teamData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            return {
                success: true,
                team: {
                    id: docRef.id,
                    userId,
                    ...teamData,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('Error adding team:', error);
            return { success: false, error: error.message };
        }
    }

    async updateTeam(teamId, updateData) {
        try {
            await updateDoc(doc(db, 'teams', teamId), {
                ...updateData,
                updatedAt: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            console.error('Error updating team:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteTeam(teamId) {
        try {
            await deleteDoc(doc(db, 'teams', teamId));
            return { success: true };
        } catch (error) {
            console.error('Error deleting team:', error);
            return { success: false, error: error.message };
        }
    }

    // --- Members ---

    async getMembers(userId) {
        try {
            const q = query(
                collection(db, 'members'),
                where('userId', '==', userId)
            );

            const querySnapshot = await getDocs(q);
            const members = [];

            querySnapshot.forEach((doc) => {
                members.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return { success: true, members };
        } catch (error) {
            console.error('Error fetching members:', error);
            return { success: false, error: error.message, members: [] };
        }
    }

    async addMember(userId, memberData) {
        try {
            const docRef = await addDoc(collection(db, 'members'), {
                userId,
                ...memberData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            return {
                success: true,
                member: {
                    id: docRef.id,
                    userId,
                    ...memberData,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('Error adding member:', error);
            return { success: false, error: error.message };
        }
    }

    async updateMember(memberId, updateData) {
        try {
            await updateDoc(doc(db, 'members', memberId), {
                ...updateData,
                updatedAt: new Date().toISOString()
            });

            return { success: true };
        } catch (error) {
            console.error('Error updating member:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteMember(memberId) {
        try {
            await deleteDoc(doc(db, 'members', memberId));
            return { success: true };
        } catch (error) {
            console.error('Error deleting member:', error);
            return { success: false, error: error.message };
        }
    }

    // Get single team
    async getTeam(teamId) {
        try {
            const docRef = doc(db, 'teams', teamId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return {
                    success: true,
                    team: {
                        id: docSnap.id,
                        ...docSnap.data()
                    }
                };
            } else {
                return { success: false, error: 'Team not found' };
            }
        } catch (error) {
            console.error('Error fetching team:', error);
            return { success: false, error: error.message };
        }
    }

    // Get single member
    async getMember(memberId) {
        try {
            const docRef = doc(db, 'members', memberId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                return {
                    success: true,
                    member: {
                        id: docSnap.id,
                        ...docSnap.data()
                    }
                };
            } else {
                return { success: false, error: 'Member not found' };
            }
        } catch (error) {
            console.error('Error fetching member:', error);
            return { success: false, error: error.message };
        }
    }

    // --- Salary Expense Automation ---

    async createMonthlySalaryExpense(userId, memberData) {
        try {
            const currentDate = new Date();
            const currentMonth = currentDate.toISOString().slice(0, 7); // YYYY-MM format

            // Create a transaction for this month's salary
            const transactionData = {
                type: 'expense',
                amount: memberData.salary / 12, // Monthly salary (assuming annual salary)
                description: `Salary - ${memberData.name} (${memberData.role})`,
                category: 'salaries',
                department: memberData.department || 'General',
                date: currentDate.toISOString().split('T')[0],
                companyId: userId,
                userType: 'company',
                autoGenerated: true,
                memberId: memberData.id || 'pending'
            };

            const result = await transactionService.addTransaction(userId, transactionData);
            return result;
        } catch (error) {
            console.error('Error creating salary expense:', error);
            return { success: false, error: error.message };
        }
    }

    async checkAndCreateMonthlySalaries(userId) {
        try {
            // Get all active members
            const membersResult = await this.getMembers(userId);
            if (!membersResult.success) {
                return { success: false, error: 'Failed to fetch members' };
            }

            const activeMembers = membersResult.members.filter(m => m.status === 'active');
            const currentMonth = new Date().toISOString().slice(0, 7);

            // Check if salary transactions already exist for this month
            const results = [];
            for (const member of activeMembers) {
                // You could add logic here to check if salary was already paid this month
                // For now, we'll create it when member is added/updated
                const result = await this.createMonthlySalaryExpense(userId, member);
                results.push(result);
            }

            return { success: true, results };
        } catch (error) {
            console.error('Error checking monthly salaries:', error);
            return { success: false, error: error.message };
        }
    }
}

export default new TeamService();
